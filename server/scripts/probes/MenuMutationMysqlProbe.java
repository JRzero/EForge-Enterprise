import java.lang.reflect.InvocationTargetException;
import java.nio.file.*;
import java.sql.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.sql.DataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.sync.RedisCommands;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.RowBounds;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.*;
import org.springframework.context.annotation.*;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.*;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.*;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.aspectj.DataScopeAspect;
import io.eforge.enterprise.framework.config.RedisConfig;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.impl.*;
import io.eforge.enterprise.web.controller.api.v1.system.*;
import io.eforge.enterprise.web.controller.system.SysMenuController;

/** Actual owned MySQL/Redis, Spring transaction/method-security proxies and original
 * mapper namespaces. Barriers only schedule genuine SQL; no mocked values/failures.
 * Calls are service/controller invocations, never claimed to be network HTTP. */
class MenuMutationMysqlProbe {
    static final long USER=9007199254740995L;
    static final String EDIT="system:menu:edit",ROOT="DepartmentMutationMapper.lockRoot";
    static final AtomicInteger assertions=new AtomicInteger();
    static final ThreadLocal<Trace> traces=new ThreadLocal<>();
    static void require(boolean condition,String message) {if(!condition)throw new AssertionError(message);}
    static void check(boolean condition,String message) {assertions.incrementAndGet();require(condition,message);}
    static String env(String key) {return Objects.requireNonNull(System.getenv(key));}
    static DataSource direct() {
        String url=env("EFORGE_MENU_MUTATION_JDBC_URL");
        require(url.startsWith("jdbc:mysql://127.0.0.1:")&&url.contains("/eforge_enterprise?"),"Unexpected menu fixture ownership.");
        return new DriverManagerDataSource(url,"root",env("EFORGE_MENU_MUTATION_JDBC_PASSWORD"));
    }
    static final class Gate {
        final String operation;final boolean after;
        final CountDownLatch reached=new CountDownLatch(1),resume=new CountDownLatch(1);
        final AtomicBoolean once=new AtomicBoolean();
        Gate(String operation,boolean after) {this.operation=operation;this.after=after;}
        void pause(String current,boolean completed) throws InterruptedException {
            if(operation.equals(current)&&after==completed&&once.compareAndSet(false,true)) {
                reached.countDown();require(resume.await(15,TimeUnit.SECONDS),"Owned SQL barrier was not released.");
            }
        }
    }
    static final class Trace {
        final List<String> operations=new CopyOnWriteArrayList<>(),writes=new CopyOnWriteArrayList<>();
        final Set<Long> connections=ConcurrentHashMap.newKeySet();
        final CountDownLatch rootStarted=new CountDownLatch(1);
        final Gate gate;volatile long connection;
        Trace(Gate gate) {this.gate=gate;}
    }
    @Intercepts({@Signature(type=Executor.class,method="query",args={MappedStatement.class,Object.class,RowBounds.class,ResultHandler.class}),
                 @Signature(type=Executor.class,method="update",args={MappedStatement.class,Object.class})})
    static final class Audit implements Interceptor {
        final DataSource source;Audit(DataSource source) {this.source=source;}
        @Override public Object intercept(Invocation invocation) throws Throwable {
            String id=((MappedStatement)invocation.getArgs()[0]).getId();
            String operation=id.substring(id.lastIndexOf('.',id.lastIndexOf('.')-1)+1);
            Trace trace=traces.get();
            if(trace!=null) {
                require(TransactionSynchronizationManager.isActualTransactionActive()
                        &&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Menu mutation escaped its writable Spring transaction.");
                Connection connection=DataSourceUtils.getConnection(source);
                try(var statement=connection.createStatement();var row=statement.executeQuery("SELECT DATABASE(),CONNECTION_ID()")) {
                    require(row.next()&&"eforge_enterprise".equals(row.getString(1)),"Mapper used an unexpected schema.");
                    trace.connection=row.getLong(2);trace.connections.add(trace.connection);
                } finally {DataSourceUtils.releaseConnection(connection,source);}
                trace.operations.add(operation);if(operation.equals(ROOT))trace.rootStarted.countDown();
                if(trace.gate!=null)trace.gate.pause(operation,false);
            }
            Object result;
            try {result=invocation.proceed();}catch(InvocationTargetException wrapper) {throw wrapper.getCause();}
            if(trace!=null) {
                if(invocation.getMethod().getName().equals("update"))trace.writes.add(operation);
                if(trace.gate!=null)trace.gate.pause(operation,true);
            }
            return result;
        }
    }
    record Users(SysUserServiceImpl service) {}
    @Configuration(proxyBeanMethods=false)
    @EnableAspectJAutoProxy(exposeProxy=true,proxyTargetClass=true)
    @EnableTransactionManagement(proxyTargetClass=true)
    @EnableMethodSecurity(proxyTargetClass=true)
    static class Config {
        @Bean DataSource source() {return direct();}
        @Bean PlatformTransactionManager transactionManager(DataSource source) {return new DataSourceTransactionManager(source);}
        @Bean DataScopeAspect dataScope() {return new DataScopeAspect();}
        @Bean(name="ss") PermissionService permission() {return new PermissionService();}
        @Bean SqlSessionFactory factory(DataSource source) throws Exception {
            var factory=new SqlSessionFactoryBean();factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity,io.eforge.enterprise.system.domain");
            var resolver=new PathMatchingResourcePatternResolver();
            var resources=new ArrayList<org.springframework.core.io.Resource>();
            for(String name:List.of("SysUser","SysRole","SysMenu","SysUserRole","SysRoleMenu","SysRoleDept","Navigation"))
                resources.add(resolver.getResource("classpath:mapper/system/"+name+"Mapper.xml"));
            factory.setMapperLocations(resources.toArray(org.springframework.core.io.Resource[]::new));
            var configuration=new org.apache.ibatis.session.Configuration();configuration.setMapUnderscoreToCamelCase(true);configuration.setDefaultStatementTimeout(12);
            for(Class<?> mapper:List.of(DepartmentMutationMapper.class,RoleSelectionMapper.class,MenuMutationMapper.class))configuration.addMapper(mapper);
            factory.setConfiguration(configuration);factory.setPlugins(new Audit(source));return factory.getObject();
        }
        @Bean SqlSessionTemplate session(SqlSessionFactory factory) {return new SqlSessionTemplate(factory);}
        @Bean SysRoleMapper roleMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleMapper.class);}
        @Bean SysMenuMapper menuMapper(SqlSessionTemplate session) {return session.getMapper(SysMenuMapper.class);}
        @Bean SysRoleMenuMapper roleMenuMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleMenuMapper.class);}
        @Bean SysRoleDeptMapper roleDeptMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleDeptMapper.class);}
        @Bean SysUserRoleMapper userRoleMapper(SqlSessionTemplate session) {return session.getMapper(SysUserRoleMapper.class);}
        @Bean DepartmentMutationMapper mutex(SqlSessionTemplate session) {return session.getMapper(DepartmentMutationMapper.class);}
        @Bean RoleSelectionMapper selections(SqlSessionTemplate session) {return session.getMapper(RoleSelectionMapper.class);}
        @Bean MenuMutationMapper menuMutations(SqlSessionTemplate session) {return session.getMapper(MenuMutationMapper.class);}
        @Bean NavigationMapper navigation(SqlSessionTemplate session) {return session.getMapper(NavigationMapper.class);}
        @Bean SysMenuServiceImpl legacyMenus() {return new SysMenuServiceImpl();}
        @Bean SysRoleServiceImpl legacyRoles() {return new SysRoleServiceImpl();}
        @Bean Users users(SqlSessionTemplate session) {
            var users=new SysUserServiceImpl();ReflectionTestUtils.setField(users,"userMapper",session.getMapper(SysUserMapper.class));return new Users(users);
        }
        @Bean SysPermissionService grants() {return new SysPermissionService();}
        @Bean AuthorizationSnapshotService authorization(Users users,NavigationMapper navigation,SysPermissionService permissions,PlatformTransactionManager manager) {
            return new AuthorizationSnapshotService(users.service(),navigation,permissions,manager);
        }
        @Bean(destroyMethod="destroy") LettuceConnectionFactory redisConnectionFactory() {
            var config=new RedisStandaloneConfiguration("127.0.0.1",Integer.parseInt(env("EFORGE_MENU_MUTATION_REDIS_PORT")));
            config.setPassword(env("EFORGE_MENU_MUTATION_REDIS_PASSWORD"));
            return new LettuceConnectionFactory(config,LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(4)).build());
        }
        @Bean RedisTemplate<Object,Object> redisTemplate(LettuceConnectionFactory factory) {return new RedisConfig().redisTemplate(factory);}
        @Bean RedisCache cache() {return new RedisCache();}
        @Bean TokenService tokens() {return new TokenService();}
        @Bean RoleSessionRefresher refresher(RedisCache cache,Users users,NavigationMapper navigation,SysPermissionService permissions,
                TokenService tokens,DepartmentMutationMapper mutex,PlatformTransactionManager manager) {
            return new RoleSessionRefresher(cache,users.service(),navigation,permissions,tokens,mutex,manager);
        }
        @Bean MenuService canonicalMenus(MenuMutationMapper mapper,SysMenuServiceImpl legacy,DepartmentMutationMapper mutex,
                RoleSessionRefresher sessions,Users users,NavigationMapper navigation,SysPermissionService permissions,PlatformTransactionManager manager) throws Exception {
            return new MenuService(mapper,legacy,mutex,new MenuRouteCatalog(new ObjectMapper()),sessions,users.service(),navigation,permissions,manager);
        }
        @Bean RoleService canonicalRoles(SysRoleServiceImpl roles,SysMenuServiceImpl menus,Users users,RoleSelectionMapper selections,
                DepartmentMutationMapper mutex,RoleSessionRefresher sessions,PlatformTransactionManager manager) {
            return new RoleService(roles,menus,null,users.service(),selections,mutex,sessions,manager);
        }
        @Bean SysMenuController controller() {return new SysMenuController();}
    }
    static void request() {
        var request=new MockHttpServletRequest();request.setRemoteAddr("127.0.0.1");request.addHeader("User-Agent","Owned menu integration probe");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
    static void principal(LoginUser login) {request();SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(login,null,List.of()));}
    static void administrator() {var admin=new SysUser(1L);admin.setUserName("owned_admin");principal(new LoginUser(1L,100L,admin,Set.of("*:*:*")));}
    static void clear() {traces.remove();SecurityContextHolder.clearContext();RequestContextHolder.resetRequestAttributes();}
    static List<Map<String,Object>> rows(JdbcTemplate sql,String table,String key) {return sql.queryForList("SELECT * FROM "+table+" ORDER BY "+key);}
    static Map<String,List<Map<String,Object>>> completeRows(JdbcTemplate sql) {
        return Map.of("menus",rows(sql,"sys_menu","menu_id"),"roles",rows(sql,"sys_role","role_id"),
                "roleMenus",rows(sql,"sys_role_menu","role_id,menu_id"),"users",rows(sql,"sys_user","user_id"),
                "userRoles",rows(sql,"sys_user_role","user_id,role_id"),"departments",rows(sql,"sys_dept","dept_id"));
    }
    static void initialize(JdbcTemplate sql,Path repository) throws Exception {
        String upstream=Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for(String table:List.of("sys_dept","sys_user","sys_role","sys_menu","sys_user_role","sys_role_menu","sys_role_dept")) {
            var match=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(upstream);
            require(match.find(),"Missing upstream IAM fixture.");sql.execute(match.group());
        }
        var migration=java.util.regex.Pattern.compile("(?is)ALTER TABLE sys_menu\\b.*?;").matcher(Files.readString(repository.resolve("sql/migrations/V001__navigation_identity.sql")));
        require(migration.find(),"Missing actual menu identity migration.");sql.execute(migration.group());
        sql.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name) VALUES(100,0,'0','Owned root')");
        sql.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,password) VALUES(?,100,'owned_editor','Owned editor','verified-hash')",USER);
        sql.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,status,data_scope) VALUES(100,'Editor','editor',1,'0','1'),(200,'Target','target',2,'0','1')");
        sql.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,100)",USER);reset(sql);
    }
    static void reset(JdbcTemplate sql) {
        sql.update("DELETE FROM sys_role_menu");sql.update("DELETE FROM sys_menu");
        sql.update("UPDATE sys_role SET status='0',del_flag='0',role_name=CASE role_id WHEN 100 THEN 'Editor' ELSE 'Target' END,update_by='',update_time=NULL");
        for(long id:List.of(1000L,1001L,1002L,2000L))sql.update("INSERT INTO sys_menu(menu_id,parent_id,menu_name,order_num,path,menu_type,status,is_frame,menu_key,perms,create_by,create_time) VALUES(?,0,?,? ,?,'F','0','1',?,?,'seed','2020-01-01')",
                id,"Owned action "+id,(int)id,"owned-"+id,"owned-action-"+id,id==1000?EDIT:id==2000?"probe:target":"");
        sql.update("INSERT INTO sys_role_menu(role_id,menu_id) VALUES(100,1000),(100,1001)");
    }
    static void grant(RoleService roles) {
        roles.update("200",new RoleContracts.RoleWriteRequest("Target","target",2,"0","",true,List.of("owned-action-2000")));
    }
    static Future<Object> async(ExecutorService worker,Trace trace,Callable<Object> action) {
        return worker.submit(()-> {administrator();traces.set(trace);try{return action.call();}finally{clear();}});
    }
    static void waiting(JdbcTemplate sql,Trace trace) throws Exception {
        check(trace.rootStarted.await(7,TimeUnit.SECONDS),"Contender did not attempt the production root lock.");
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(7);
        while(System.nanoTime()<deadline) {
            Integer count=sql.queryForObject("SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.threads t ON t.THREAD_ID=w.REQUESTING_THREAD_ID WHERE t.PROCESSLIST_ID=?",Integer.class,trace.connection);
            if(count!=null&&count>0) {check(trace.operations.equals(List.of(ROOT)),"Contender read menu or role state before obtaining the root lock.");return;}
            Thread.sleep(25);
        }
        throw new AssertionError("No actual InnoDB shared-root wait was observed.");
    }
    static void noOrphan(JdbcTemplate sql) {
        check(sql.queryForObject("SELECT COUNT(*) FROM sys_role_menu rm LEFT JOIN sys_menu m ON m.menu_id=rm.menu_id WHERE m.menu_id IS NULL",Integer.class)==0,"An orphan role-menu grant was persisted.");
    }
    static void races(AnnotationConfigApplicationContext context,JdbcTemplate sql) throws Exception {
        var roles=context.getBean(RoleService.class);var controller=context.getBean(SysMenuController.class);
        for(boolean deletionFirst:List.of(false,true)) {
            reset(sql);var before=completeRows(sql);var gate=new Gate(deletionFirst?"SysMenuMapper.deleteMenuById":"SysRoleMapper.updateRole",deletionFirst);
            var firstTrace=new Trace(gate);var secondTrace=new Trace(null);var workers=Executors.newFixedThreadPool(2);
            Future<Object> first=null,second=null;
            try {
                first=async(workers,firstTrace,()-> {if(deletionFirst)return controller.remove(2000L);grant(roles);return null;});
                check(gate.reached.await(7,TimeUnit.SECONDS),"First production writer did not reach the intended SQL boundary.");
                check(firstTrace.operations.get(0).equals(ROOT),"First writer did not lock the shared root before business reads.");
                if(!deletionFirst)check(firstTrace.operations.contains("RoleSelectionMapper.menus")&&firstTrace.writes.isEmpty(),"Grant barrier is not after actual menu validation and before persistence.");
                else check(firstTrace.writes.contains("SysMenuMapper.deleteMenuById"),"Delete barrier is not after the real DELETE SQL.");
                second=async(workers,secondTrace,()-> {if(!deletionFirst)return controller.remove(2000L);grant(roles);return null;});
                waiting(sql,secondTrace);check(!second.isDone(),"Contending writer completed while the root lock was held.");
                check(before.equals(completeRows(sql)),"An independent connection saw uncommitted menu/grant state.");
                gate.resume.countDown();first.get(12,TimeUnit.SECONDS);
                if(deletionFirst) {
                    try {second.get(12,TimeUnit.SECONDS);throw new AssertionError("Grant accepted a menu deleted by the lock winner.");}
                    catch(ExecutionException failure) {check(failure.getCause() instanceof ApiFailure api&&api.status()==404&&"ROLE_MENU_NOT_FOUND".equals(api.code()),"Deleted-menu grant failed for an unexpected reason.");}
                    check(sql.queryForObject("SELECT COUNT(*) FROM sys_menu WHERE menu_id=2000",Integer.class)==0&&sql.queryForObject("SELECT COUNT(*) FROM sys_role_menu WHERE role_id=200",Integer.class)==0,"Delete-first result retained a stale menu/grant.");
                    check(before.get("roles").equals(rows(sql,"sys_role","role_id")),"Rejected grant changed the role row.");
                } else {
                    var result=(AjaxResult)second.get(12,TimeUnit.SECONDS);
                    check(Integer.valueOf(601).equals(result.get(AjaxResult.CODE_TAG))&&"菜单已分配,不允许删除".equals(result.get(AjaxResult.MSG_TAG)),"Delete did not preserve the original already-assigned warning.");
                    check(sql.queryForObject("SELECT COUNT(*) FROM sys_menu WHERE menu_id=2000",Integer.class)==1&&sql.queryForObject("SELECT COUNT(*) FROM sys_role_menu WHERE role_id=200 AND menu_id=2000",Integer.class)==1,"Grant-first result lost its valid menu relation.");
                }
                check(firstTrace.connections.size()==1&&secondTrace.connections.size()==1&&!firstTrace.connections.equals(secondTrace.connections),"Race did not use two independent transaction-bound connections.");
                noOrphan(sql);
                check(before.get("users").equals(rows(sql,"sys_user","user_id"))&&before.get("userRoles").equals(rows(sql,"sys_user_role","user_id,role_id")),"Menu race changed account identities or assignments.");
                System.out.println("PASS CASE: "+(deletionFirst?"delete commits first; later role grant rejects deleted menu":"role grant validates first; legacy delete waits and warns already assigned")+"; real SQL root wait, no orphan relations");
            } finally {
                gate.resume.countDown();if(first!=null&&!first.isDone())first.cancel(true);if(second!=null&&!second.isDone())second.cancel(true);
                workers.shutdownNow();require(workers.awaitTermination(15,TimeUnit.SECONDS),"Owned race workers did not terminate.");
            }
        }
    }
    static SysMenu patch(long id,String permission) {
        var menu=new SysMenu();menu.setMenuId(id);menu.setParentId(0L);menu.setMenuName("Owned action "+id);
        menu.setPath("owned-"+id);menu.setRouteName("Owned"+id);menu.setIsFrame("1");menu.setMenuType("F");menu.setStatus("0");menu.setPerms(permission);return menu;
    }
    static void successful(AjaxResult result) {check(Integer.valueOf(200).equals(result.get(AjaxResult.CODE_TAG)),"Legacy operation did not preserve success.");}
    static void permissionCases(AnnotationConfigApplicationContext context,JdbcTemplate sql,RedisCommands<String,String> redis) {
        reset(sql);var tokens=context.getBean(TokenService.class);var users=context.getBean(Users.class);var controller=context.getBean(SysMenuController.class);
        var user=users.service().selectUserById(USER);var session=new LoginUser(USER,100L,user,Set.of());request();
        try {tokens.createToken(session);}finally{clear();}
        check(session.getPermissions().equals(Set.of(EDIT)),"The actual login snapshot has permissions beyond menu edit.");
        String key=CacheConstants.LOGIN_TOKEN_KEY+session.getToken();
        try {
            for(long target:List.of(1000L,1002L)) {
                var before=completeRows(sql);String bytes=redis.get(key);long ttl=redis.pttl(key);
                principal(tokens.getLoginUserByToken(session.getToken()));var trace=new Trace(null);traces.set(trace);
                try {controller.edit(patch(target,target==1000?"*:*:*":EDIT));throw new AssertionError("Legacy menu edit accepted escalation or an inaccessible object.");}
                catch(AccessDeniedException expected) {check(trace.operations.get(0).equals(ROOT)&&trace.writes.isEmpty(),"Rejected edit wrote SQL or skipped the root boundary.");}
                finally {clear();}
                check(before.equals(completeRows(sql)),"Rejected menu edit changed SQL rows or relationships.");
                check(bytes.equals(redis.get(key))&&redis.pttl(key)>0&&redis.pttl(key)<=ttl,"Rejected menu edit rewrote or extended the actual Redis session.");
            }
            for(String value:Arrays.asList(null,EDIT)) {
                long target=1000;
                principal(tokens.getLoginUserByToken(session.getToken()));var trace=new Trace(null);traces.set(trace);
                try {successful(controller.edit(patch(target,value)));}finally{clear();}
                check((value==null?EDIT:value).equals(sql.queryForObject("SELECT perms FROM sys_menu WHERE menu_id=?",String.class,target)),"Legacy null/unchanged/clear semantics changed.");
                check(trace.operations.get(0).equals(ROOT)&&trace.connections.size()==1,"Compatible edit escaped the original shared transaction boundary.");
            }
            principal(tokens.getLoginUserByToken(session.getToken()));traces.set(new Trace(null));
            try {successful(controller.edit(patch(1001,EDIT)));}finally{clear();}
            check(EDIT.equals(sql.queryForObject("SELECT perms FROM sys_menu WHERE menu_id=1001",String.class)),"A legitimate currently held permission could not be assigned.");
            principal(tokens.getLoginUserByToken(session.getToken()));var clearTrace=new Trace(null);traces.set(clearTrace);
            try {successful(controller.edit(patch(1001,"")));}finally{clear();}
            check("".equals(sql.queryForObject("SELECT perms FROM sys_menu WHERE menu_id=1001",String.class))
                    &&clearTrace.operations.get(0).equals(ROOT)&&clearTrace.connections.size()==1,"Legacy explicit clear did not remove a previously nonempty permission atomically.");
            var current=tokens.getLoginUserByToken(session.getToken());tokens.refreshAuthorization(current);
            check(current.getPermissions().equals(Set.of(EDIT)),"Legitimate edit introduced unexpected current authority.");
            sql.update("UPDATE sys_role SET status='1' WHERE role_id=100");
            try {
                var disabledRows=completeRows(sql);String cached=redis.get(key);long ttl=redis.pttl(key);
                principal(tokens.getLoginUserByToken(session.getToken()));var trace=new Trace(null);traces.set(trace);
                try {controller.edit(patch(1000,EDIT));throw new AssertionError("A stale principal reused an inactive role's menu object grant.");}
                catch(AccessDeniedException expected) {check(trace.writes.isEmpty(),"Inactive role rejection wrote menu data.");}
                finally {clear();}
                check(disabledRows.equals(completeRows(sql))&&cached.equals(redis.get(key))&&redis.pttl(key)>0&&redis.pttl(key)<=ttl,
                        "Inactive role rejection changed SQL/cache state or session lifetime.");
            } finally {sql.update("UPDATE sys_role SET status='0' WHERE role_id=100");}
            noOrphan(sql);
            System.out.println("PASS CASE: actual non-admin edit-only login cannot write wildcard/inaccessible menu; exact SQL/Redis preserved; null/unchanged/clear and current-grant edits succeed");
        } finally {redis.del(key);clear();}
    }
    static void remainingWriters(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        reset(sql);var controller=context.getBean(SysMenuController.class);administrator();var trace=new Trace(null);traces.set(trace);
        try {var menu=patch(3000,"");successful(controller.add(menu));}finally{clear();}
        check(trace.operations.get(0).equals(ROOT)&&trace.connections.size()==1&&sql.queryForObject("SELECT COUNT(*) FROM sys_menu WHERE menu_id=3000",Integer.class)==1,"Legacy add missed its actual root/transaction boundary.");
        administrator();trace=new Trace(null);traces.set(trace);
        try {successful(controller.updateSort(Map.of("menuIds","1000,1001","orderNums","71,72")));}finally{clear();}
        check(trace.operations.get(0).equals(ROOT)&&trace.connections.size()==1&&sql.queryForList("SELECT order_num FROM sys_menu WHERE menu_id IN(1000,1001) ORDER BY menu_id",Integer.class).equals(List.of(71,72)),"Legacy sort missed its actual root/transaction boundary or original behavior.");
        noOrphan(sql);System.out.println("PASS CASE: legacy add/sort use the same root lock and writable transaction");
    }
    public static void main(String[] args) throws Exception {
        var sql=new JdbcTemplate(direct());initialize(sql,Path.of(args[0]));
        var client=RedisClient.create(RedisURI.Builder.redis("127.0.0.1",Integer.parseInt(env("EFORGE_MENU_MUTATION_REDIS_PORT"))).withPassword(env("EFORGE_MENU_MUTATION_REDIS_PASSWORD").toCharArray()).build());
        try(var redis=client.connect();var context=new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("owned-probe",Map.of("token.header","Authorization","token.expireTime",60,"token.secret",Base64.getEncoder().encodeToString(new byte[64]))));
            context.register(Config.class);context.refresh();
            races(context,sql);permissionCases(context,sql,redis.sync());remainingWriters(context,sql);
            check(redis.sync().keys("*").isEmpty(),"Owned Redis fixture was not cleaned.");
            System.out.println("PASS: actual menu role-grant/delete lock and legacy permission-boundary assertions="+assertions.get());
        } finally {client.shutdown();clear();}
    }
}
