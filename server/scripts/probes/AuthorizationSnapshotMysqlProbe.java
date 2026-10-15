import java.lang.reflect.InvocationTargetException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Consumer;
import javax.sql.DataSource;
import com.alibaba.druid.pool.DruidDataSource;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.RowBounds;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.*;
import org.springframework.transaction.support.*;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.datasource.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.impl.*;

/** Actual MyBatis XML, Spring transactions, DynamicDataSource and bounded Druid pools.
 * The script owns both schemas in one disposable MySQL instance. No Redis or HTTP
 * authentication is claimed here; those are exercised by the recovery harness. */
class AuthorizationSnapshotMysqlProbe {
    static final long USER = 9007199254740995L;
    static final String MASTER_SCHEMA = "eforge_enterprise", SLAVE_SCHEMA = "eforge_auth_shadow";
    static final AtomicInteger assertions = new AtomicInteger(), mapperQueries = new AtomicInteger();
    static final ThreadLocal<Long> lastReadConnection = new ThreadLocal<>();
    static volatile ReadGate gate;
    static int poolSize = 2;
    static void require(boolean condition, String message) {if (!condition) throw new AssertionError(message);}
    static void check(boolean condition, String message) {assertions.incrementAndGet();require(condition, message);}
    static String url(boolean slave) {
        String url = Objects.requireNonNull(System.getenv("EFORGE_AUTH_PROBE_JDBC_URL"));
        require(url.contains("/" + MASTER_SCHEMA + "?"), "Unexpected isolated database URL.");
        return slave ? url.replace("/" + MASTER_SCHEMA + "?", "/" + SLAVE_SCHEMA + "?") : url;
    }
    static DriverManagerDataSource direct(boolean slave) {
        return new DriverManagerDataSource(url(slave), "root", System.getenv("EFORGE_AUTH_PROBE_JDBC_PASSWORD"));
    }
    static DruidDataSource pool(boolean slave) {
        var pool = new DruidDataSource();
        pool.setUrl(url(slave));pool.setUsername("root");pool.setPassword(System.getenv("EFORGE_AUTH_PROBE_JDBC_PASSWORD"));
        pool.setInitialSize(0);pool.setMinIdle(0);pool.setMaxActive(slave ? 1 : poolSize);pool.setMaxWait(700);
        pool.setTestWhileIdle(false);pool.setTestOnBorrow(false);pool.setTestOnReturn(false);
        return pool;
    }
    static final class ReadGate {
        final CountDownLatch root = new CountDownLatch(1), resume = new CountDownLatch(1);
        final AtomicBoolean first = new AtomicBoolean(true);
    }
    @Intercepts(@Signature(type=Executor.class, method="query", args={MappedStatement.class,Object.class,RowBounds.class,ResultHandler.class}))
    static final class ReadAudit implements Interceptor {
        private final DataSource source;
        ReadAudit(DataSource source) {this.source=source;}
        @Override public Object intercept(Invocation call) throws Throwable {
            MappedStatement statement=(MappedStatement)call.getArgs()[0];
            String sql=statement.getBoundSql(call.getArgs()[1]).getSql().toUpperCase(Locale.ROOT);
            require(sql.stripLeading().startsWith("SELECT") && !sql.contains("FOR UPDATE"), "Authorization must use non-locking reads.");
            require("MASTER".equals(DynamicDataSourceContextHolder.getDataSourceType()), "Authorization mapper did not route to MASTER.");
            require(TransactionSynchronizationManager.isActualTransactionActive() && TransactionSynchronizationManager.isCurrentTransactionReadOnly(), "Authorization mapper escaped the actual read-only transaction.");
            Connection connection=DataSourceUtils.getConnection(source);
            try (Statement inspect=connection.createStatement();var row=inspect.executeQuery("SELECT DATABASE(), CONNECTION_ID(), @@transaction_isolation")) {
                require(row.next() && MASTER_SCHEMA.equals(row.getString(1)), "Authorization used the shadow database.");
                require("REPEATABLE-READ".equals(row.getString(3)) && connection.isReadOnly(), "Actual connection isolation/readOnly is incorrect.");
                lastReadConnection.set(row.getLong(2));
            } finally {DataSourceUtils.releaseConnection(connection,source);}
            mapperQueries.incrementAndGet();
            Object result;
            try {result=call.proceed();} catch (InvocationTargetException wrapped) {throw wrapped.getCause();}
            ReadGate current=gate;
            if(current!=null && statement.getId().endsWith("SysUserMapper.selectUserById") && current.first.compareAndSet(true,false)) {
                current.root.countDown();
                require(current.resume.await(15,TimeUnit.SECONDS), "Concurrent writer did not release the actual root read.");
            }
            return result;
        }
    }
    @Configuration(proxyBeanMethods=false)
    static class Config {
        @Bean(name="master",destroyMethod="close") DruidDataSource master() {return pool(false);}
        @Bean(name="slave",destroyMethod="close") DruidDataSource slave() {return pool(true);}
        @Bean @Primary DynamicDataSource routing(@Qualifier("master") DataSource master,@Qualifier("slave") DataSource slave) {
            return new DynamicDataSource(master,Map.of("MASTER",master,"SLAVE",slave));
        }
        @Bean PlatformTransactionManager manager(DynamicDataSource source) {return new DataSourceTransactionManager(source);}
        @Bean JdbcTemplate jdbc(DynamicDataSource source) {return new JdbcTemplate(source);}
        @Bean SqlSessionFactory factory(DynamicDataSource source) throws Exception {
            var factory=new SqlSessionFactoryBean();factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity");
            var resources=new PathMatchingResourcePatternResolver();
            factory.setMapperLocations(resources.getResource("classpath:mapper/system/SysUserMapper.xml"),
                    resources.getResource("classpath:mapper/system/SysMenuMapper.xml"),resources.getResource("classpath:mapper/system/NavigationMapper.xml"));
            var configuration=new org.apache.ibatis.session.Configuration();configuration.setDefaultStatementTimeout(4);
            factory.setConfiguration(configuration);factory.setPlugins(new ReadAudit(source));return factory.getObject();
        }
        @Bean AuthorizationSnapshotService authorization(SqlSessionFactory factory,PlatformTransactionManager manager) {
            var session=new SqlSessionTemplate(factory);
            // These exact production service methods delegate to the real mapped SQL.
            // Keep unrelated service dependencies out of this focused Spring context.
            var users=new SysUserServiceImpl();ReflectionTestUtils.setField(users,"userMapper",session.getMapper(SysUserMapper.class));
            var menus=new SysMenuServiceImpl();ReflectionTestUtils.setField(menus,"menuMapper",session.getMapper(SysMenuMapper.class));
            var permissions=new SysPermissionService();ReflectionTestUtils.setField(permissions,"menuService",menus);
            return new AuthorizationSnapshotService(users,session.getMapper(NavigationMapper.class),permissions,manager);
        }
    }
    static LoginUser cached() {
        SysUser user=new SysUser(USER);user.setUserName("cached");user.setNickName("Cached");user.setDeptId(999L);
        var session=new LoginUser(USER,999L,user,Set.of("obsolete:grant"));
        session.setToken("owned-probe-token");session.setLoginTime(101L);session.setExpireTime(202L);
        session.rememberCacheSnapshot(new byte[]{1,2,3});return session;
    }
    static void sessionMetadata(LoginUser session) {
        check("owned-probe-token".equals(session.getToken()) && session.getLoginTime()==101L && session.getExpireTime()==202L
                && Arrays.equals(new byte[]{1,2,3},session.cacheSnapshot()),"SQL snapshot changed the Redis CAS base or session lifetime.");
    }
    static ApiFailure safeFailure(Runnable operation,int status) {
        try {operation.run();throw new AssertionError("Expected controlled authorization failure.");}
        catch(ApiFailure failure) {
            check(failure.status()==status,"Wrong authorization failure status.");
            check(status!=503 || ("AUTHORIZATION_UNAVAILABLE".equals(failure.code()) && "Current authorization could not be verified.".equals(failure.getMessage())),"Storage details escaped the safe failure.");
            return failure;
        }
    }
    static void initialize(Path repository) throws Exception {
        var main=new JdbcTemplate(direct(false));main.execute("CREATE DATABASE " + SLAVE_SCHEMA);
        String source=Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for(boolean slave:List.of(false,true)) {
            var db=new JdbcTemplate(direct(slave));
            for(String table:List.of("sys_dept","sys_user","sys_role","sys_menu","sys_user_role","sys_role_menu")) {
                var match=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(source);
                require(match.find(),"Missing upstream IAM table.");db.execute(match.group());
            }
            db.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name) VALUES(100,0,'0','Root'),(103,100,'0,100','Old'),(105,100,'0,100','New')");
            db.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,password) VALUES(?,103,'snapshot_actor',?,'hash-before'),(1,103,'admin','Admin','admin-hash')",USER,slave?"Shadow":"Before");
            for(int role=0;role<7;role++) {
                db.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag) VALUES(?,?,?,?,?,?,?)",100+role,"Role "+role,"role_"+role,role,role==0?"2":"5",role==2?"1":"0",role==3?"2":"0");
                db.update("INSERT INTO sys_menu(menu_id,menu_name,menu_type,perms) VALUES(?,?,'F',?)",1000+role,"Grant "+role,"probe:old:"+role);
                db.update("INSERT INTO sys_role_menu(role_id,menu_id) VALUES(?,?)",100+role,1000+role);
            }
            for(int role=0;role<4;role++)db.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,?)",USER,100+role);
        }
    }
    static TransactionTemplate transaction(PlatformTransactionManager manager) {
        var tx=new TransactionTemplate(manager);tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);return tx;
    }
    static void baseline(AuthorizationSnapshotService service,int roles) {
        var durations=new ArrayList<Long>();int before=mapperQueries.get();
        for(int i=0;i<20;i++) {
            var session=cached();long start=System.nanoTime();service.refresh(session);durations.add(System.nanoTime()-start);
            check(session.getUser().getRoles().size()==roles && session.getPermissions().size()==roles,"Role-count baseline returned incomplete authority.");
        }
        check(mapperQueries.get()-before==20*(roles+2),"Unexpected mapper SQL query count for full authorization read.");
        Collections.sort(durations);
        System.out.printf(Locale.ROOT,"BASELINE: roles=%d samples=20 mapper_queries/request=%d median_ms=%.3f p95_ms=%.3f (instrumented local MySQL, not a production capacity claim)%n",
                roles,roles+2,durations.get(9)/1_000_000.0,durations.get(18)/1_000_000.0);
    }
    static void exercise(AnnotationConfigApplicationContext context) throws Exception {
        var service=context.getBean(AuthorizationSnapshotService.class);var jdbc=context.getBean(JdbcTemplate.class);
        var manager=context.getBean(PlatformTransactionManager.class);var master=new JdbcTemplate(direct(false));
        var session=cached();service.refresh(session);
        check(session.getUserId()==USER && session.getDeptId()==103L && "Before".equals(session.getUser().getNickName()),"Actual user and department were not loaded.");
        check(session.getUser().getRoles().stream().map(role->role.getRoleId()).toList().equals(List.of(100L,101L)),"Disabled/deleted roles survived effective-role loading.");
        check(session.getPermissions().equals(Set.of("probe:old:0","probe:old:1")),"Actual role grants differ.");
        check("2".equals(session.getUser().getRoles().get(0).getDataScope()) && session.getUser().getRoles().get(0).getPermissions().equals(Set.of("probe:old:0"))
                && "5".equals(session.getUser().getRoles().get(1).getDataScope()) && session.getUser().getRoles().get(1).getPermissions().equals(Set.of("probe:old:1")),"Cross-role data-scope permission association was flattened.");
        sessionMetadata(session);check(DynamicDataSourceContextHolder.getDataSourceType()==null,"Empty route context was not restored.");
        baseline(service,2);
        for(int role=104;role<=106;role++)master.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,?)",USER,role);
        baseline(service,5);master.update("DELETE FROM sys_user_role WHERE user_id=? AND role_id>=104",USER);

        DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
        try {
            transaction(manager).execute(status->{
                long caller=jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class);
                check("Shadow".equals(jdbc.queryForObject("SELECT nick_name FROM sys_user WHERE user_id=?",String.class,USER)),"Shadow route fixture is not distinct.");
                var current=cached();service.refresh(current);
                check("Before".equals(current.getUser().getNickName()),"Caller SLAVE route leaked into authority.");
                check("SLAVE".equals(DynamicDataSourceContextHolder.getDataSourceType()) && caller==jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class)
                        && SLAVE_SCHEMA.equals(jdbc.queryForObject("SELECT DATABASE()",String.class)),"Caller route/transaction connection was not restored.");
                check(TransactionSynchronizationManager.isActualTransactionActive()&&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Caller writable transaction flags were not restored.");
                status.setRollbackOnly();return null;
            });
        } finally {DynamicDataSourceContextHolder.clearDataSourceType();}

        var executor=Executors.newSingleThreadExecutor();var currentGate=new ReadGate();gate=currentGate;
        try {
            var read=executor.submit(()->{var current=cached();service.refresh(current);return current;});
            check(currentGate.root.await(10,TimeUnit.SECONDS),"Did not reach actual user SQL read.");
            transaction(new DataSourceTransactionManager(master.getDataSource())).execute(status->{
                // This commits while the reader is suspended after SELECT, proving no mutation root lock is held.
                master.queryForObject("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE",Long.class);
                master.update("UPDATE sys_user SET nick_name='After',dept_id=105,password='hash-after' WHERE user_id=?",USER);
                master.update("UPDATE sys_role SET role_key='role_new',data_scope='3' WHERE role_id=100");
                master.update("DELETE FROM sys_user_role WHERE user_id=? AND role_id=101",USER);
                master.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,104)",USER);
                master.update("UPDATE sys_menu SET perms='probe:new:0' WHERE menu_id=1000");
                master.update("UPDATE sys_menu SET perms='probe:new:4' WHERE menu_id=1004");return null;
            });
            currentGate.resume.countDown();var old=read.get(10,TimeUnit.SECONDS);
            check("Before".equals(old.getUser().getNickName())&&old.getDeptId()==103L&&"hash-before".equals(old.getUser().getPassword()),"Concurrent commit mixed user fields.");
            check(old.getPermissions().equals(Set.of("probe:old:0","probe:old:1"))&&old.getUser().getRoles().get(1).getRoleId()==101L
                    &&"2".equals(old.getUser().getRoles().get(0).getDataScope()),"Concurrent commit mixed role/grant read views.");
        } finally {currentGate.resume.countDown();gate=null;executor.shutdownNow();}
        var fresh=cached();service.refresh(fresh);
        check("After".equals(fresh.getUser().getNickName())&&fresh.getDeptId()==105L&&"hash-after".equals(fresh.getUser().getPassword()),"Next request did not read new user fields.");
        check(fresh.getPermissions().equals(Set.of("probe:new:0","probe:new:4"))&&fresh.getUser().getRoles().get(1).getRoleId()==104L
                &&"3".equals(fresh.getUser().getRoles().get(0).getDataScope()),"Next request did not read new role/grant snapshot.");

        transaction(manager).execute(status->{
            long caller=jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class);
            jdbc.update("UPDATE sys_user SET nick_name='Uncommitted' WHERE user_id=?",USER);
            var current=cached();service.refresh(current);
            check("After".equals(current.getUser().getNickName()) && lastReadConnection.get()!=caller,"Reader joined caller uncommitted transaction.");
            check(caller==jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class)&&"Uncommitted".equals(jdbc.queryForObject("SELECT nick_name FROM sys_user WHERE user_id=?",String.class,USER)),"Caller transaction did not resume exactly.");
            status.setRollbackOnly();return null;
        });
        check("After".equals(master.queryForObject("SELECT nick_name FROM sys_user WHERE user_id=?",String.class,USER)),"Outer rollback was lost.");
        transaction(manager).execute(status->{
            check("After".equals(jdbc.queryForObject("SELECT nick_name FROM sys_user WHERE user_id=?",String.class,USER)),"Old RR view was not established.");
            master.update("UPDATE sys_user SET nick_name='Latest' WHERE user_id=?",USER);
            var current=cached();service.refresh(current);
            check("Latest".equals(current.getUser().getNickName()),"Independent snapshot reused the caller's old RR view.");
            check("After".equals(jdbc.queryForObject("SELECT nick_name FROM sys_user WHERE user_id=?",String.class,USER)),"Caller old RR view was not restored.");
            status.setRollbackOnly();return null;
        });

        try(var rootConnection=direct(false).getConnection()) {
            rootConnection.setAutoCommit(false);
            try(var lock=rootConnection.createStatement()) {lock.executeQuery("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE").close();}
            var pool=Executors.newSingleThreadExecutor();
            try {var read=pool.submit(()->{var current=cached();service.refresh(current);return current;});check("Latest".equals(read.get(5,TimeUnit.SECONDS).getUser().getNickName()),"Snapshot waited on the IAM mutation root lock.");}
            finally {rootConnection.rollback();pool.shutdownNow();}
        }
        master.update("UPDATE sys_role SET status='1' WHERE role_id IN(100,104)");
        var none=cached();service.refresh(none);check(none.getPermissions().isEmpty()&&none.getUser().getRoles().isEmpty(),"No-active-role snapshot used cached/upstream fallback grants.");
        master.update("UPDATE sys_role SET status='0' WHERE role_id IN(100,104)");
        var admin=cached();admin.setUserId(1L);service.refresh(admin);check(admin.getPermissions().equals(Set.of("*:*:*")),"Administrator wildcard regressed.");
        for(String assignment:List.of("status='1'","del_flag='2'")) {
            master.update("UPDATE sys_user SET "+assignment+" WHERE user_id=?",USER);
            var rejected=cached();var original=rejected.getUser();safeFailure(()->service.refresh(rejected),401);
            check(rejected.getUser()==original && rejected.getPermissions().equals(Set.of("obsolete:grant")),"Rejected account published partial authority.");
            master.update("UPDATE sys_user SET status='0',del_flag='0' WHERE user_id=?",USER);
        }
        var absent=cached();absent.setUserId(USER+1);safeFailure(()->service.refresh(absent),401);
        master.execute("RENAME TABLE sys_role_menu TO authorization_private_fault");
        DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
        try {
            var failed=cached();var original=failed.getUser();safeFailure(()->service.refresh(failed),503);
            check(failed.getUser()==original&&failed.getDeptId()==999L&&failed.getPermissions().equals(Set.of("obsolete:grant")),"SQL failure published a partial authority graph.");
            sessionMetadata(failed);check("SLAVE".equals(DynamicDataSourceContextHolder.getDataSourceType()),"Failed SQL did not restore caller route.");
        } finally {DynamicDataSourceContextHolder.clearDataSourceType();master.execute("RENAME TABLE authorization_private_fault TO sys_role_menu");}
        var recovered=cached();service.refresh(recovered);check(recovered.getPermissions().equals(Set.of("probe:new:0","probe:new:4")),"SQL recovery still used stale grants.");
        check(master.queryForObject("SELECT COUNT(*) FROM sys_user",Integer.class)==2&&master.queryForObject("SELECT COUNT(*) FROM sys_role",Integer.class)==7
                &&master.queryForObject("SELECT COUNT(*) FROM sys_role_menu",Integer.class)==7,"Read/failure tests changed fixture row counts.");
        check(context.getBean("master",DruidDataSource.class).getActiveCount()==0&&context.getBean("slave",DruidDataSource.class).getActiveCount()==0,"Probe leaked a pooled connection.");
    }
    static void smallPool(AnnotationConfigApplicationContext context) {
        var service=context.getBean(AuthorizationSnapshotService.class);var jdbc=context.getBean(JdbcTemplate.class);
        var manager=context.getBean(PlatformTransactionManager.class);
        service.refresh(cached());check(context.getBean("master",DruidDataSource.class).getMaxActive()==1,"Small-pool fixture is not bounded to one.");
        transaction(manager).execute(status->{
            long caller=jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class);var rejected=cached();var original=rejected.getUser();
            long started=System.nanoTime();safeFailure(()->service.refresh(rejected),503);long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
            check(elapsed<5000,"Pool exhaustion did not fail within the configured bounded wait.");
            check(rejected.getUser()==original&&rejected.getPermissions().equals(Set.of("obsolete:grant")),"Pool exhaustion fell back to cached authority.");
            check(caller==jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class)&&TransactionSynchronizationManager.isActualTransactionActive()
                    &&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Pool exhaustion lost the outer transaction.");
            System.out.println("BOUNDARY: maxActive=1 with an outer transaction returns safe 503 after "+elapsed+"ms; REQUIRES_NEW requires an additional connection.");
            status.setRollbackOnly();return null;
        });
        var recovered=cached();service.refresh(recovered);check(recovered.getPermissions().equals(Set.of("probe:new:0","probe:new:4")),"Single-connection pool failed to recover after outer rollback.");
        check(context.getBean("master",DruidDataSource.class).getActiveCount()==0,"Exhaustion leaked a pooled connection.");
    }
    /** The login thread verifies the actual current BCrypt hash, then pauses while
     * a different connection commits. Final confirmation must not upgrade that
     * earlier credential proof to a changed identity. No AuthenticationManager,
     * captcha, JWT issuing or success-audit claim is made by this focused probe. */
    static LoginUser loginRace(AuthorizationSnapshotService service,JdbcTemplate master,String rawPassword,
            Consumer<JdbcTemplate> mutation,boolean accepted) throws Exception {
        var verifiedReady=new CountDownLatch(1);var mutationCommitted=new CountDownLatch(1);
        var executor=Executors.newSingleThreadExecutor();
        try {
            var login=executor.submit(()->{
                try {
                    var verified=cached();service.refresh(verified);
                    check(SecurityUtils.matchesPassword(rawPassword,verified.getPassword()),"Initial BCrypt credential proof was not valid.");
                    var originalUser=verified.getUser();String original=com.alibaba.fastjson2.JSON.toJSONString(verified);
                    verifiedReady.countDown();require(mutationCommitted.await(10,TimeUnit.SECONDS),"Final-login mutation did not commit.");
                    DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
                    if(accepted)service.confirmLogin(verified);
                    else {
                        safeFailure(()->service.confirmLogin(verified),401);
                        check(verified.getUser()==originalUser && original.equals(com.alibaba.fastjson2.JSON.toJSONString(verified)),"Rejected final proof changed the original LoginUser graph.");
                    }
                    check("SLAVE".equals(DynamicDataSourceContextHolder.getDataSourceType()),"Final credential confirmation failed to restore the caller route.");
                    sessionMetadata(verified);return verified;
                } finally {DynamicDataSourceContextHolder.clearDataSourceType();lastReadConnection.remove();}
            });
            check(verifiedReady.await(10,TimeUnit.SECONDS),"Login did not reach the verified-credential barrier.");
            transaction(new DataSourceTransactionManager(master.getDataSource())).execute(status->{mutation.accept(master);return null;});
            mutationCommitted.countDown();return login.get(10,TimeUnit.SECONDS);
        } finally {mutationCommitted.countDown();executor.shutdownNow();}
    }
    static void finalProof(AnnotationConfigApplicationContext context) throws Exception {
        var service=context.getBean(AuthorizationSnapshotService.class);var master=new JdbcTemplate(direct(false));
        var baseline=master.queryForMap("SELECT user_name,nick_name,password,dept_id,status,del_flag FROM sys_user WHERE user_id=?",USER);
        String priorPermission=master.queryForObject("SELECT perms FROM sys_menu WHERE menu_id=1000",String.class);
        String priorScope=master.queryForObject("SELECT data_scope FROM sys_role WHERE role_id=100",String.class);
        String raw="Owned authorization proof #2026",validHash=SecurityUtils.encryptPassword(raw);
        try {
            master.update("UPDATE sys_user SET password=? WHERE user_id=?",validHash,USER);
            String changedHash=SecurityUtils.encryptPassword("Owned changed password #2026");
            var rejected=loginRace(service,master,raw,db->db.update("UPDATE sys_user SET password=? WHERE user_id=?",changedHash,USER),false);
            check(validHash.equals(rejected.getPassword()),"Rejected password proof was replaced with the new hash.");
            // Existing located Redis sessions deliberately use refresh, not confirmLogin.
            // A password change alone has never meant a forced logout in this contract.
            service.refresh(rejected);
            check(changedHash.equals(rejected.getPassword())&&rejected.getPermissions().equals(Set.of("probe:new:0","probe:new:4")),"Existing-session refresh incorrectly treats a password change as a new login.");
            sessionMetadata(rejected);
            master.update("UPDATE sys_user SET password=? WHERE user_id=?",validHash,USER);

            loginRace(service,master,raw,db->db.update("UPDATE sys_user SET user_name='renamed_actor' WHERE user_id=?",USER),false);
            master.update("UPDATE sys_user SET user_name=? WHERE user_id=?",baseline.get("user_name"),USER);
            var disabled=loginRace(service,master,raw,db->db.update("UPDATE sys_user SET status='1' WHERE user_id=?",USER),false);
            safeFailure(()->service.refresh(disabled),401);
            master.update("UPDATE sys_user SET status='0' WHERE user_id=?",USER);

            var accepted=loginRace(service,master,raw,db->{
                db.update("UPDATE sys_user SET dept_id=103,nick_name='Fresh verified' WHERE user_id=?",USER);
                db.update("UPDATE sys_role SET data_scope='4' WHERE role_id=100");
                db.update("UPDATE sys_menu SET perms='probe:proof:fresh' WHERE menu_id=1000");
            },true);
            check(validHash.equals(accepted.getPassword())&&accepted.getDeptId()==103L&&"Fresh verified".equals(accepted.getUser().getNickName()),"Same valid proof did not receive the current user/department snapshot.");
            check(accepted.getPermissions().equals(Set.of("probe:proof:fresh","probe:new:4"))&&"4".equals(accepted.getUser().getRoles().get(0).getDataScope())
                    &&accepted.getUser().getRoles().get(0).getPermissions().equals(Set.of("probe:proof:fresh")),"Final login kept stale or flattened grants/data scope.");
            System.out.println("PROOF: real BCrypt verification -> separate committed hash/rename/disable mutation -> unchanged rejected principal; unchanged hash -> fresh grants/department; established-session refresh keeps password-change semantics.");
        } finally {
            transaction(new DataSourceTransactionManager(master.getDataSource())).execute(status->{
                master.update("UPDATE sys_user SET user_name=?,nick_name=?,password=?,dept_id=?,status=?,del_flag=? WHERE user_id=?",baseline.get("user_name"),baseline.get("nick_name"),baseline.get("password"),baseline.get("dept_id"),baseline.get("status"),baseline.get("del_flag"),USER);
                master.update("UPDATE sys_menu SET perms=? WHERE menu_id=1000",priorPermission);
                master.update("UPDATE sys_role SET data_scope=? WHERE role_id=100",priorScope);return null;
            });
        }
    }
    public static void main(String[] args) throws Exception {
        initialize(Path.of(args[0]));
        try {
            try(var context=new AnnotationConfigApplicationContext(Config.class)) {exercise(context);finalProof(context);}
            poolSize=1;
            try(var context=new AnnotationConfigApplicationContext(Config.class)) {smallPool(context);}
            System.out.println("PASS: "+assertions.get()+" actual authorization snapshot assertions; MASTER routing, independent RR, concurrent final login proof, per-role scope, faults, bounded pools. Redis/HTTP acceptance is separate.");
        } finally {DynamicDataSourceContextHolder.clearDataSourceType();lastReadConnection.remove();}
    }
}
