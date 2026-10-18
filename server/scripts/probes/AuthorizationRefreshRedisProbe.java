import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import com.alibaba.druid.pool.DruidDataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.AclSetuserArgs;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.protocol.CommandType;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.FastJson2JsonRedisSerializer;
import io.eforge.enterprise.framework.config.RedisConfig;
import io.eforge.enterprise.framework.datasource.DynamicDataSource;
import io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.filter.DiagnosticConsoleAuthenticator;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.impl.*;
import io.eforge.enterprise.web.controller.api.v1.system.RoleService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;

/** Real MySQL/Redis/ACL/Lua and production JWT/permission servlet boundary.
 * No network HTTP server, mocked Redis, fake session mutation, or production fault hook. */
class AuthorizationRefreshRedisProbe {
    static final long USER = 9007199254740995L, ROLE = 100L;
    static final String GRANT = "probe:document:read", ACL_USER = "authorization_probe";
    static final AtomicInteger assertions = new AtomicInteger();
    static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    static void check(boolean condition, String message) { assertions.incrementAndGet(); require(condition, message); }
    static String env(String name) { return Objects.requireNonNull(System.getenv(name), "Missing probe environment: " + name); }
    static void field(Object target, String name, Object value) { ReflectionTestUtils.setField(target, name, value); }
    enum Fault { NONE, INITIAL_READ, AFTER_FIRST_CAS }
    record Session(String label, String key, String jwt, byte[] before, long ttlBefore) { }

    /** Delegates every value/read/write to production RedisCache. Only order and barriers are test-owned. */
    static final class OrderedCache extends RedisCache {
        final RedisCommands<String,String> admin;
        List<String> orderedKeys = List.of();
        final List<String> reads = new ArrayList<>(), writes = new ArrayList<>(), successes = new ArrayList<>();
        Fault fault = Fault.NONE;
        boolean armed;
        boolean measuring;
        int enumerations, snapshotReads, casCalls;
        Runnable afterEnumeration;
        OrderedCache(RedisCommands<String,String> admin) { this.admin = admin; }
        void arm(Fault next, List<Session> sessions) {
            fault = next; armed = true; orderedKeys = sessions.stream().map(Session::key).toList();
            reads.clear(); writes.clear(); successes.clear();
        }
        void disarm() { armed = false; fault = Fault.NONE; }
        @Override public Collection<String> keys(String pattern) {
            if(measuring)enumerations++;
            Collection<String> actual = super.keys(pattern);
            if(afterEnumeration!=null)afterEnumeration.run();
            if (!armed) return actual;
            require(actual != null && new HashSet<>(actual).equals(new HashSet<>(orderedKeys)), "Real Redis enumeration differs from the three owned sessions.");
            if (fault == Fault.INITIAL_READ)
                require("OK".equals(admin.aclSetuser(ACL_USER, new AclSetuserArgs().removeCommand(CommandType.GET))), "Cannot arm real GET ACL failure.");
            return List.copyOf(orderedKeys);
        }
        @Override public <T> CacheSnapshot<T> getExpiringCacheSnapshot(String key) {
            if(measuring)snapshotReads++;
            if (armed) reads.add(key);
            return super.getExpiringCacheSnapshot(key);
        }
        @Override public boolean compareAndSetExpiringCacheObject(String key, byte[] before, byte[] value) {
            if(measuring)casCalls++;
            if (armed) writes.add(key);
            boolean updated = super.compareAndSetExpiringCacheObject(key, before, value);
            if (armed && updated) {
                successes.add(key);
                if (fault == Fault.AFTER_FIRST_CAS && successes.size() == 1) {
                    require(key.equals(orderedKeys.get(0)), "The first successful production CAS was not session A.");
                    require("OK".equals(admin.aclSetuser(ACL_USER, new AclSetuserArgs()
                            .removeCommand(CommandType.SET).removeCommand(CommandType.DEL))), "Cannot arm real SET/DEL ACL failure.");
                }
            }
            return updated;
        }
    }

    static final class RuntimeBoundary {
        final OrderedCache cache;
        final TokenService tokens;
        final RoleService roles;
        final JwtAuthenticationTokenFilter filter;
        final ApiSecurityProblemHandler problems = new ApiSecurityProblemHandler(new ObjectMapper());
        final PermissionService permission = new PermissionService();
        final SysUserServiceImpl users;
        final RoleSessionRefresher refresher;
        RuntimeBoundary(DataSource source, LettuceConnectionFactory redis, RedisCommands<String,String> admin) throws Exception {
            PlatformTransactionManager manager = new DataSourceTransactionManager(source);
            var factory = new SqlSessionFactoryBean(); factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity");
            var resources = new PathMatchingResourcePatternResolver();
            factory.setMapperLocations(resources.getResource("classpath:mapper/system/SysUserMapper.xml"),
                    resources.getResource("classpath:mapper/system/SysRoleMapper.xml"),
                    resources.getResource("classpath:mapper/system/SysMenuMapper.xml"),
                    resources.getResource("classpath:mapper/system/NavigationMapper.xml"));
            var configuration = new org.apache.ibatis.session.Configuration(); configuration.setDefaultStatementTimeout(5);
            configuration.addMapper(RoleSelectionMapper.class); configuration.addMapper(DepartmentMutationMapper.class);
            factory.setConfiguration(configuration);
            SqlSessionFactory mapped = factory.getObject(); var session = new SqlSessionTemplate(mapped);
            users = new SysUserServiceImpl(); field(users, "userMapper", session.getMapper(SysUserMapper.class));
            var menus = new SysMenuServiceImpl(); field(menus, "menuMapper", session.getMapper(SysMenuMapper.class));
            var legacyRoles = new SysRoleServiceImpl(); field(legacyRoles, "roleMapper", session.getMapper(SysRoleMapper.class));
            var permissions = new SysPermissionService(); field(permissions, "menuService", menus);
            var navigation = session.getMapper(NavigationMapper.class);
            var authorization = new AuthorizationSnapshotService(users, navigation, permissions, manager);
            cache = new OrderedCache(admin); cache.redisTemplate = new RedisConfig().redisTemplate(redis);
            tokens = new TokenService(); field(tokens, "redisCache", cache); field(tokens, "authorization", authorization);
            field(tokens, "header", "Authorization"); field(tokens, "expireTime", 60);
            field(tokens, "secret", Base64.getEncoder().encodeToString(new byte[64]));
            var mutex = session.getMapper(DepartmentMutationMapper.class);
            refresher = new RoleSessionRefresher(cache, users, navigation, permissions, tokens, mutex, manager);
            // status uses these concrete services/mappers; unrelated CRUD dependencies are deliberately absent.
            roles = new RoleService(legacyRoles, menus, null, users, session.getMapper(RoleSelectionMapper.class), mutex, refresher, manager);
            filter = new JwtAuthenticationTokenFilter(); field(filter, "tokenService", tokens);
            var providers = new StaticListableBeanFactory(); providers.addBean("problems", problems);
            field(filter, "apiProblems", providers.getBeanProvider(ApiSecurityProblemHandler.class));
            field(filter, "consoleAuthenticator", providers.getBeanProvider(DiagnosticConsoleAuthenticator.class));
        }
        List<Session> sessions(RedisCommands<String,String> admin) {
            return sessions(admin,3);
        }
        List<Session> sessions(RedisCommands<String,String> admin,int count) {
            return sessions(admin,count,USER);
        }
        List<Session> sessions(RedisCommands<String,String> admin,int count,long userId) {
            var results = new ArrayList<Session>();
            for (int index=0;index<count;index++) {
                String label=index<3?List.of("A","B","C").get(index):"session-"+index;
                MockHttpServletRequest request = request();
                RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
                try {
                    SysUser user = users.selectUserById(userId);
                    LoginUser verified = new LoginUser(userId, user.getDeptId(), user, Set.of());
                    String jwt = tokens.createToken(verified);
                    String key = CacheConstants.LOGIN_TOKEN_KEY + verified.getToken();
                    byte[] bytes = raw(admin, key); long ttl = admin.pttl(key);
                    check(ttl > 55 * 60 * 1000, "Fresh fixture session TTL is unexpectedly short.");
                    check(decode(bytes).getPermissions().equals(userId==1?Set.of("*:*:*"):Set.of(GRANT)), "Actual login fence did not persist the initial grant.");
                    results.add(new Session(label, key, jwt, bytes, ttl));
                } finally { RequestContextHolder.resetRequestAttributes(); }
            }
            check(results.stream().map(Session::key).distinct().count() == count, "Owned logins must produce distinct sessions.");
            return results;
        }
        int protectedRequest(String jwt, boolean requireGrant) throws Exception {
            SecurityContextHolder.clearContext();
            var request = request(); request.setRequestURI("/api/v1/probe/protected"); request.addHeader("Authorization", "Bearer " + jwt);
            var response = new MockHttpServletResponse();
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
            try {
                filter.doFilter(request, response, (incoming, outgoing) -> {
                    var authentication = SecurityContextHolder.getContext().getAuthentication();
                    check(authentication != null && authentication.getPrincipal() instanceof LoginUser, "Old JWT did not traverse production authentication.");
                    var current = (LoginUser) authentication.getPrincipal();
                    boolean permitted = permission.hasPermi(GRANT);
                    check(permitted == requireGrant, "Production permission check used stale Redis authority.");
                    if (!requireGrant) check(current.getPermissions().isEmpty() && current.getUser().getRoles().isEmpty(), "Revoked request principal retained role permissions.");
                    if (permitted) { response.setStatus(200); response.getWriter().write("owned-protected-content"); }
                    else problems.handle(request, response, new AccessDeniedException("Required permission is absent."));
                });
                check(response.getStatus() == (requireGrant ? 200 : 403), "Unexpected protected servlet boundary status.");
                if (!requireGrant) {
                    String body = response.getContentAsString();
                    check(body.contains("ACCESS_DENIED") && !body.contains("owned-protected-content"), "Denied JWT returned protected content.");
                }
                return response.getStatus();
            } finally { RequestContextHolder.resetRequestAttributes(); SecurityContextHolder.clearContext(); }
        }
        RuntimeException revoke() {
            var actor = new SysUser(1L); actor.setUserName("admin");
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    new LoginUser(1L, 103L, actor, Set.of("*:*:*")), null, List.of()));
            try { roles.status(Long.toString(ROLE), "1"); throw new AssertionError("The real Redis ACL fault was not reached."); }
            catch (RuntimeException failure) { return failure; }
            finally { SecurityContextHolder.clearContext(); }
        }
    }

    static MockHttpServletRequest request() {
        var request = new MockHttpServletRequest(); request.setMethod("GET"); request.setRemoteAddr("127.0.0.1");
        request.addHeader("User-Agent", "Owned authorization integration probe"); return request;
    }
    static byte[] raw(RedisCommands<String,String> admin, String key) {
        String value = admin.get(key); require(value != null, "An owned fixture session unexpectedly disappeared.");
        return value.getBytes(StandardCharsets.UTF_8);
    }
    static LoginUser decode(byte[] value) {
        return (LoginUser) new FastJson2JsonRedisSerializer<Object>(Object.class).deserialize(value);
    }
    static boolean denied(Throwable failure) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Throwable current = failure; current != null && seen.add(current); current = current.getCause()) {
            String message = Objects.toString(current.getMessage(), "").toLowerCase(Locale.ROOT);
            if (message.contains("noperm") || message.contains("can't run this command") || message.contains("not allowed")
                    || message.contains("acl failure in script") && message.contains("has no permissions to run")) return true;
        }
        return false;
    }
    static void aclLog(RedisCommands<String,String> admin, String command) {
        check(admin.aclLog().stream().anyMatch(row -> ACL_USER.equals(row.get("username"))
                && command.equalsIgnoreCase(Objects.toString(row.get("object"), ""))
                && "command".equals(row.get("reason"))), "Real Redis ACL log does not confirm denied " + command + ".");
    }
    static void scenario(RuntimeBoundary runtime, JdbcTemplate sql, RedisCommands<String,String> admin, Fault fault) throws Exception {
        runtime.cache.disarm(); sql.update("UPDATE sys_role SET status='0' WHERE role_id=?", ROLE);
        List<Session> sessions = runtime.sessions(admin);
        for (Session session : sessions) runtime.protectedRequest(session.jwt(), true);
        var beforeUser = sql.queryForMap("SELECT * FROM sys_user WHERE user_id=?", USER);
        var beforeLinks = sql.queryForList("SELECT * FROM sys_user_role");
        admin.aclLogReset(); runtime.cache.arm(fault, sessions);
        RuntimeException failure;
        try { failure = runtime.revoke(); }
        finally {
            require("OK".equals(admin.aclSetuser(ACL_USER, new AclSetuserArgs().allCommands())), "Owned Redis ACL recovery failed.");
            runtime.cache.disarm();
        }
        assertions.incrementAndGet();
        if (!denied(failure)) throw new AssertionError("Refresh failure did not come from actual Redis command authorization.", failure);
        check("1".equals(sql.queryForObject("SELECT status FROM sys_role WHERE role_id=?", String.class, ROLE)), "Role change was not committed on the independent SQL connection.");
        check(sql.queryForObject("SELECT COUNT(*) FROM sys_user_role ur JOIN sys_role r ON r.role_id=ur.role_id WHERE ur.user_id=? AND r.status='0' AND r.del_flag='0'", Integer.class, USER) == 0, "Effective SQL grant remains active.");
        check(beforeUser.equals(sql.queryForMap("SELECT * FROM sys_user WHERE user_id=?", USER)) && beforeLinks.equals(sql.queryForList("SELECT * FROM sys_user_role")), "Role status mutation changed account or role assignment data.");
        List<String> keys = sessions.stream().map(Session::key).toList();
        if (fault == Fault.INITIAL_READ) {
            check(runtime.cache.reads.equals(keys.subList(0, 1)) && runtime.cache.writes.isEmpty(), "Initial read fault occurred after a write or after another session.");
            aclLog(admin, "get");
        } else {
            check(runtime.cache.reads.equals(keys.subList(0, 2)) && runtime.cache.writes.equals(keys.subList(0, 2))
                    && runtime.cache.successes.equals(keys.subList(0, 1)), "Actual A-success/B-failure/C-unprocessed ordering was not established.");
            aclLog(admin, "set"); aclLog(admin, "del");
            check(Arrays.stream(failure.getSuppressed()).anyMatch(AuthorizationRefreshRedisProbe::denied), "B compensating deletion did not fail through the actual Redis ACL.");
        }
        for (int index = 0; index < sessions.size(); index++) {
            Session session = sessions.get(index); byte[] after = raw(admin, session.key()); long ttl = admin.pttl(session.key());
            boolean refreshed = fault == Fault.AFTER_FIRST_CAS && index == 0;
            check(refreshed ? !Arrays.equals(after, session.before()) : Arrays.equals(after, session.before()), "Unexpected persisted session bytes for " + session.label() + ".");
            check(decode(after).getPermissions().equals(refreshed ? Set.of() : Set.of(GRANT)), "Unexpected persisted permission content for " + session.label() + ".");
            check(ttl > 0 && ttl <= session.ttlBefore(), "Mutation extended or removed session lifetime for " + session.label() + ".");
            int status = runtime.protectedRequest(session.jwt(), false);
            check(Arrays.equals(after, raw(admin, session.key())), "Protected request rewrote session contents instead of validating current SQL.");
            check(admin.pttl(session.key()) <= ttl, "Recovery authentication extended an unexpired session TTL.");
            System.out.printf("RECOVERY: fault=%s session=%s persisted=%s ttl_not_extended=true original_jwt_status=%d%n", fault, session.label(), refreshed ? "updated" : "original", status);
        }
        check(admin.del(keys.toArray(String[]::new)) == 3, "Owned scenario session cleanup was incomplete.");
        System.out.printf("SCENARIO: %s actual_acl=true sql_committed=true protected_boundary=production_filter_and_permission PASS%n", fault);
    }

    static void initialize(JdbcTemplate sql, Path repository) throws Exception {
        String upstream = Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for (String table : List.of("sys_dept", "sys_user", "sys_role", "sys_menu", "sys_user_role", "sys_role_menu")) {
            var ddl = java.util.regex.Pattern.compile("(?is)create table " + table + "\\s*\\(.*?;").matcher(upstream);
            require(ddl.find(), "Missing upstream IAM table fixture."); sql.execute(ddl.group());
        }
        sql.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name) VALUES(100,0,'0','Root'),(103,100,'0,100','Owned')");
        sql.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,password) VALUES(?,103,'acl_actor','Owned','verified-hash'),(1,103,'admin','Admin','admin-hash')", USER);
        sql.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag) VALUES(?,'Owned role','owned_acl',1,'5','0','0')", ROLE);
        sql.update("INSERT INTO sys_menu(menu_id,menu_name,menu_type,perms) VALUES(1000,'Owned protected grant','F',?)", GRANT);
        sql.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,?)", USER, ROLE);
        sql.update("INSERT INTO sys_role_menu(role_id,menu_id) VALUES(?,1000)", ROLE);
    }
    static void scale(RuntimeBoundary runtime,JdbcTemplate sql,RedisCommands<String,String> admin){
        runtime.cache.disarm();sql.update("UPDATE sys_role SET status='0' WHERE role_id=?",ROLE);
        for(int[] sample:List.of(new int[]{3,3},new int[]{30,30},new int[]{100,100},new int[]{100,3})){
            int count=sample[0],affected=sample[1];
            var sessions=new ArrayList<>(runtime.sessions(admin,affected));
            if(count>affected)sessions.addAll(runtime.sessions(admin,count-affected,1));
            try{
                var cache=runtime.cache;cache.enumerations=0;cache.snapshotReads=0;cache.casCalls=0;
                long started=System.nanoTime();cache.measuring=true;
                try{runtime.refresher.refresh(Set.of(USER));}finally{cache.measuring=false;}
                double elapsed=(System.nanoTime()-started)/1_000_000.0;
                check(cache.enumerations==1&&cache.snapshotReads==count&&cache.casCalls==affected,"Refresh scale baseline changed: inspect actual Redis operations.");
                for(var session:sessions){
                    var current=raw(admin,session.key());
                    check(decode(current).getPermissions().equals(decode(session.before()).getPermissions()),"Scale refresh changed effective authority.");
                    if(decode(session.before()).getUserId()==1)check(Arrays.equals(current,session.before()),"Unrelated session bytes were modified.");
                    check(admin.pttl(session.key())>0&&admin.pttl(session.key())<=session.ttlBefore(),"Scale refresh changed original session lifetime.");
                }
                System.out.printf(Locale.ROOT,"REFRESH_SCALE: sessions=%d affected=%d enumeration=%d snapshot_lua=%d cas_lua=%d elapsed_ms=%.3f; includes SQL and shared-lock transaction, not Redis-only time%n",count,affected,cache.enumerations,cache.snapshotReads,cache.casCalls,elapsed);
            }finally{check(admin.del(sessions.stream().map(Session::key).toArray(String[]::new))==count,"Owned scale session cleanup incomplete.");}
        }
    }
    static void lockWait(RuntimeBoundary runtime,JdbcTemplate sql,RedisCommands<String,String> admin)throws Exception{
        var sessions=runtime.sessions(admin);
        var worker=java.util.concurrent.Executors.newSingleThreadExecutor();
        var waiting=new java.util.concurrent.atomic.AtomicReference<java.util.concurrent.Future<Double>>();
        runtime.cache.afterEnumeration=()->{
            waiting.set(worker.submit(()->{
                try(var connection=Objects.requireNonNull(sql.getDataSource()).getConnection()){
                    connection.setAutoCommit(false);
                    long start=System.nanoTime();
                    try(var statement=connection.prepareStatement("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE")){statement.executeQuery().close();}
                    double elapsed=(System.nanoTime()-start)/1_000_000.0;connection.rollback();return elapsed;
                }
            }));
            boolean observed=false;
            for(int attempt=0;attempt<100;attempt++){
                if(sql.queryForObject("SELECT COUNT(*) FROM performance_schema.data_lock_waits",Integer.class)>0){observed=true;break;}
                try{Thread.sleep(10);}catch(InterruptedException failure){Thread.currentThread().interrupt();throw new IllegalStateException(failure);}
            }
            check(observed,"The real root-row contender was not observed waiting during Redis enumeration.");
            check(!waiting.get().isDone(),"The root-row contender escaped the refresh transaction.");
        };
        try{
            runtime.refresher.refresh(Set.of(USER));
            double elapsed=waiting.get().get(5,java.util.concurrent.TimeUnit.SECONDS);
            System.out.printf(Locale.ROOT,"REFRESH_LOCK: actual InnoDB waiter observed during enumeration; contender_ms=%.3f (includes diagnostic coordination, not production latency)%n",elapsed);
        }finally{
            runtime.cache.afterEnumeration=null;worker.shutdownNow();worker.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS);
            check(admin.del(sessions.stream().map(Session::key).toArray(String[]::new))==3,"Owned lock sample cleanup incomplete.");
        }
    }
    public static void main(String[] args) throws Exception {
        String url = env("EFORGE_AUTH_REFRESH_JDBC_URL");
        require(url.startsWith("jdbc:mysql://127.0.0.1:") && url.contains("/eforge_enterprise?"), "Probe JDBC target is not the owned localhost fixture.");
        int redisPort = Integer.parseInt(env("EFORGE_AUTH_REFRESH_REDIS_PORT"));
        var direct = new DriverManagerDataSource(url, "root", env("EFORGE_AUTH_REFRESH_JDBC_PASSWORD"));
        var sql = new JdbcTemplate(direct); initialize(sql, Path.of(args[0]));
        RedisClient client = RedisClient.create("redis://127.0.0.1:" + redisPort);
        try (StatefulRedisConnection<String,String> adminConnection = client.connect(); DruidDataSource pool = new DruidDataSource()) {
            var admin = adminConnection.sync();
            require("OK".equals(admin.aclSetuser(ACL_USER, new AclSetuserArgs().reset().on().allKeys().allCommands()
                    .addPassword(env("EFORGE_AUTH_REFRESH_REDIS_PASSWORD")))), "Cannot initialize isolated Redis ACL user.");
            var redisConfig = new RedisStandaloneConfiguration("127.0.0.1", redisPort);
            redisConfig.setUsername(ACL_USER); redisConfig.setPassword(env("EFORGE_AUTH_REFRESH_REDIS_PASSWORD"));
            var redis = new LettuceConnectionFactory(redisConfig, LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(4)).build());
            redis.afterPropertiesSet(); redis.start();
            try {
                pool.setUrl(url); pool.setUsername("root"); pool.setPassword(env("EFORGE_AUTH_REFRESH_JDBC_PASSWORD"));
                pool.setInitialSize(0); pool.setMinIdle(0); pool.setMaxActive(4); pool.setMaxWait(3000); pool.setTestWhileIdle(false);
                var routing = new DynamicDataSource(pool, Map.of("MASTER", pool));
                var runtime = new RuntimeBoundary(routing, redis, admin);
                scenario(runtime, sql, admin, Fault.INITIAL_READ);
                scenario(runtime, sql, admin, Fault.AFTER_FIRST_CAS);
                scale(runtime,sql,admin);
                lockWait(runtime,sql,admin);
                check(sql.queryForObject("SELECT COUNT(*) FROM sys_user", Integer.class) == 2
                        && sql.queryForObject("SELECT COUNT(*) FROM sys_role", Integer.class) == 1
                        && sql.queryForObject("SELECT COUNT(*) FROM sys_role_menu", Integer.class) == 1, "Unexpected physical IAM row changes.");
                check(admin.keys("*").isEmpty(), "Owned Redis session fixtures were not removed.");
                System.out.println("PASS: authorization initial-read and partial-CAS Redis recovery; assertions=" + assertions.get());
            } finally {
                // The independent admin connection remains usable when the application ACL fails.
                try { admin.aclSetuser(ACL_USER, new AclSetuserArgs().allCommands()); }
                finally { redis.destroy(); admin.aclDeluser(ACL_USER); }
            }
        } finally { client.shutdown(); SecurityContextHolder.clearContext(); RequestContextHolder.resetRequestAttributes(); DynamicDataSourceContextHolder.clearDataSourceType(); }
    }
}
