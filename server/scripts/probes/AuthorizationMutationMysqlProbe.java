import java.nio.file.*;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.RowBounds;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.*;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.impl.*;
import io.eforge.enterprise.web.controller.api.v1.system.*;

/** Real MySQL/mapper/production mutations and real afterCommit registration.
 * Only the callback body is an observer: this proves SQL commit, lock release,
 * rollback and publication timing, not Redis writes or session CAS behavior. */
class AuthorizationMutationMysqlProbe {
    static final long USER=9007199254740995L;
    static int assertions,mutations,rootLocks;
    static void check(boolean condition,String message) {assertions++;if(!condition)throw new AssertionError(message);}
    static DataSource direct() {
        String url=Objects.requireNonNull(System.getenv("EFORGE_AUTH_MUTATION_JDBC_URL"));
        return new DriverManagerDataSource(url,"root",System.getenv("EFORGE_AUTH_MUTATION_JDBC_PASSWORD"));
    }
    static void login() {
        var admin=new SysUser(1L);admin.setUserName("probe_admin");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new LoginUser(1L,100L,admin,Set.of("*:*:*")),null,List.of()));
    }
    @Intercepts({@Signature(type=Executor.class,method="query",args={MappedStatement.class,Object.class,RowBounds.class,ResultHandler.class}),
                 @Signature(type=Executor.class,method="update",args={MappedStatement.class,Object.class})})
    static final class TransactionAudit implements Interceptor {
        @Override public Object intercept(Invocation call) throws Throwable {
            if(!TransactionSynchronizationManager.isActualTransactionActive()||TransactionSynchronizationManager.isCurrentTransactionReadOnly())
                throw new AssertionError("Production mutation mapper did not join the actual writable transaction.");
            var mapped=(MappedStatement)call.getArgs()[0];
            if(mapped.getId().endsWith("DepartmentMutationMapper.lockRoot"))rootLocks++;
            if(call.getMethod().getName().equals("update"))mutations++;
            return call.proceed();
        }
    }
    static String observedValue(JdbcTemplate jdbc,String kind) {
        return kind.equals("role") ? jdbc.queryForObject("SELECT status FROM sys_role WHERE role_id=100",String.class)
                : jdbc.queryForObject("SELECT CONCAT(status,'|',perms,'|',menu_name) FROM sys_menu WHERE menu_id=1000",String.class);
    }
    static String before(String kind) {return kind.equals("role")?"0":"0|probe:old|Original action";}
    static String after(String kind) {return kind.equals("role")?"1":"1|probe:changed|Changed action";}
    static final class CommitObserver extends RoleSessionRefresher {
        final List<Set<Long>> published=new ArrayList<>();
        String kind;long callerConnection;
        CommitObserver(PlatformTransactionManager manager) {super(null,null,null,null,null,null,manager);}
        void expect(String nextKind,long caller) {kind=nextKind;callerConnection=caller;published.clear();}
        @Override public void refresh(Set<Long> affected) {
            // Intentionally inherit production refreshAfterCommit without overriding it.
            // A genuinely independent connection must obtain the root lock and see
            // the new business row. A pre-commit callback fails on the real row lock.
            try(Connection connection=direct().getConnection()) {
                connection.setAutoCommit(false);
                try {
                    try(Statement sql=connection.createStatement()) {
                        sql.setQueryTimeout(4);sql.execute("SET SESSION innodb_lock_wait_timeout=2");
                        try(var row=sql.executeQuery("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE")) {
                            check(row.next()&&row.getLong(1)==100L,"Callback did not acquire the actual committed mutation root lock.");
                        }
                        try(var row=sql.executeQuery("SELECT CONNECTION_ID()")) {
                            check(row.next()&&(callerConnection==0||row.getLong(1)!=callerConnection),"Callback accidentally reused the outer SQL connection.");
                        }
                        String query=kind.equals("role")?"SELECT status FROM sys_role WHERE role_id=100"
                                :"SELECT CONCAT(status,'|',perms,'|',menu_name) FROM sys_menu WHERE menu_id=1000";
                        try(var row=sql.executeQuery(query)) {
                            check(row.next()&&after(kind).equals(row.getString(1)),"Callback did not see the committed production mutation.");
                        }
                    }
                    check(affected.equals(Set.of(USER)),"Callback published the wrong exact user identity.");
                    published.add(Set.copyOf(affected));
                } finally {connection.rollback();}
            } catch(SQLException failure) {throw new AssertionError("Callback ran before commit/root-lock release or failed independent SQL verification.",failure);}
        }
    }
    record Services(RoleService roles,MenuService menus) {}
    @Configuration(proxyBeanMethods=false)
    static class Config {
        @Bean DataSource source() {return direct();}
        @Bean JdbcTemplate jdbc(DataSource source) {return new JdbcTemplate(source);}
        @Bean PlatformTransactionManager manager(DataSource source) {return new DataSourceTransactionManager(source);}
        @Bean SqlSessionFactory factory(DataSource source) throws Exception {
            var factory=new SqlSessionFactoryBean();factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity");
            var resolver=new PathMatchingResourcePatternResolver();
            factory.setMapperLocations(resolver.getResource("classpath:mapper/system/SysRoleMapper.xml"),resolver.getResource("classpath:mapper/system/SysMenuMapper.xml"));
            var configuration=new org.apache.ibatis.session.Configuration();configuration.setMapUnderscoreToCamelCase(true);configuration.setDefaultStatementTimeout(5);
            configuration.addMapper(DepartmentMutationMapper.class);configuration.addMapper(RoleSelectionMapper.class);configuration.addMapper(MenuMutationMapper.class);
            factory.setConfiguration(configuration);factory.setPlugins(new TransactionAudit());return factory.getObject();
        }
        @Bean CommitObserver callbacks(PlatformTransactionManager manager) {return new CommitObserver(manager);}
        @Bean Services services(SqlSessionFactory factory,PlatformTransactionManager manager,CommitObserver callbacks) throws Exception {
            var session=new SqlSessionTemplate(factory);
            var roles=new SysRoleServiceImpl();ReflectionTestUtils.setField(roles,"roleMapper",session.getMapper(SysRoleMapper.class));
            var menus=new SysMenuServiceImpl();ReflectionTestUtils.setField(menus,"menuMapper",session.getMapper(SysMenuMapper.class));
            var mutex=session.getMapper(DepartmentMutationMapper.class);
            // Unused collaborators are deliberately absent for these two public
            // production operations; persistence and authorization guards are real.
            var roleService=new RoleService(roles,menus,null,null,session.getMapper(RoleSelectionMapper.class),mutex,callbacks,manager);
            var menuService=new MenuService(session.getMapper(MenuMutationMapper.class),menus,mutex,new MenuRouteCatalog(new ObjectMapper()),callbacks,null,null,null,manager);
            return new Services(roleService,menuService);
        }
    }
    static void initialize(Path repository) throws Exception {
        var jdbc=new JdbcTemplate(direct());String source=Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for(String table:List.of("sys_dept","sys_user","sys_role","sys_menu","sys_user_role","sys_role_menu")) {
            var match=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(source);
            if(!match.find())throw new AssertionError("Missing upstream IAM fixture table.");jdbc.execute(match.group());
        }
        String migration=Files.readString(repository.resolve("sql/migrations/V001__navigation_identity.sql"));
        var alter=java.util.regex.Pattern.compile("(?is)ALTER TABLE sys_menu\\b.*?;").matcher(migration);
        if(!alter.find())throw new AssertionError("Missing actual canonical menu migration.");jdbc.execute(alter.group());
        jdbc.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name) VALUES(100,0,'0','Owned root')");
        jdbc.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name) VALUES(?,100,'owned_actor','Owned actor')",USER);
        jdbc.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status) VALUES(100,'Owned role','owned_role',1,'5','0')");
        jdbc.update("INSERT INTO sys_menu(menu_id,menu_name,menu_type,menu_key,perms) VALUES(1000,'Original action','F','owned-action','probe:old')");
        jdbc.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,100)",USER);jdbc.update("INSERT INTO sys_role_menu(role_id,menu_id) VALUES(100,1000)");
    }
    static void mutate(Services services,String kind) {
        if(kind.equals("role"))services.roles().status("100","1");
        else services.menus().update("1000",new MenuContracts.MenuWriteRequest("owned-action","Changed action","0",1,
                MenuContracts.Type.FUNCTION,"1",true,null,null,"probe:changed","","",null,"",true));
    }
    static void reset(JdbcTemplate jdbc) {
        jdbc.update("UPDATE sys_role SET status='0' WHERE role_id=100");
        jdbc.update("UPDATE sys_menu SET status='0',perms='probe:old',menu_name='Original action' WHERE menu_id=1000");
    }
    static void exercise(AnnotationConfigApplicationContext context) {
        var services=context.getBean(Services.class);var callbacks=context.getBean(CommitObserver.class);
        var jdbc=context.getBean(JdbcTemplate.class);var observer=new JdbcTemplate(direct());
        var outer=new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
        for(String kind:List.of("role","menu")) {
            for(boolean rollback:List.of(false,true)) {
                reset(observer);int writesBefore=mutations,locksBefore=rootLocks;
                outer.executeWithoutResult(status->{
                    long connection=jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class);callbacks.expect(kind,connection);
                    mutate(services,kind);
                    check(callbacks.published.isEmpty(),"Inner REQUIRED method published before outer completion.");
                    check(after(kind).equals(observedValue(jdbc,kind)),"Actual caller transaction cannot see its mutation.");
                    check(before(kind).equals(observedValue(observer,kind)),"Independent connection saw uncommitted authorization.");
                    check(connection==jdbc.queryForObject("SELECT CONNECTION_ID()",Long.class),"Mutation replaced the outer connection.");
                    if(rollback)status.setRollbackOnly();
                });
                check((rollback?before(kind):after(kind)).equals(observedValue(observer,kind)),"Outer commit/rollback did not govern the actual business row.");
                check(callbacks.published.equals(rollback?List.of():List.of(Set.of(USER))),"Wrong number of committed session callbacks.");
                check(mutations==writesBefore+1&&rootLocks==locksBefore+1,"Test did not execute one actual mapper write under the production mutex.");
                check(!TransactionSynchronizationManager.isActualTransactionActive(),"Outer transaction leaked beyond completion.");
                System.out.println("PASS CASE: "+kind+" outer REQUIRED "+(rollback?"rollback: original SQL value, zero callbacks":"commit: one callback acquires independent root lock and reads committed value"));
            }
            reset(observer);callbacks.expect(kind,0);int writesBefore=mutations,locksBefore=rootLocks;
            mutate(services,kind);
            check(after(kind).equals(observedValue(observer,kind))&&callbacks.published.equals(List.of(Set.of(USER))),"Standalone mutation did not publish exactly once after its own commit.");
            check(mutations==writesBefore+1&&rootLocks==locksBefore+1,"Standalone path missed actual mutation/lock SQL.");
            System.out.println("PASS CASE: "+kind+" standalone transaction commits and publishes once");
        }
        reset(observer);
        check(observer.queryForObject("SELECT COUNT(*) FROM sys_user",Integer.class)==1&&observer.queryForObject("SELECT COUNT(*) FROM sys_role",Integer.class)==1
                &&observer.queryForObject("SELECT COUNT(*) FROM sys_menu",Integer.class)==1&&observer.queryForObject("SELECT COUNT(*) FROM sys_user_role",Integer.class)==1
                &&observer.queryForObject("SELECT COUNT(*) FROM sys_role_menu",Integer.class)==1,"Mutation tests changed unrelated fixture ownership/bindings.");
        check("5".equals(observer.queryForObject("SELECT data_scope FROM sys_role WHERE role_id=100",String.class)),"Status mutation changed unrelated data scope.");
    }
    public static void main(String[] args) throws Exception {
        initialize(Path.of(args[0]));login();
        try(var context=new AnnotationConfigApplicationContext(Config.class)) {
            exercise(context);
            System.out.println("PASS: "+assertions+" actual MySQL assertions across 6 production RoleService/MenuService transaction cases. Callback timing/committed reads only; Redis session writes are outside this probe.");
        } finally {SecurityContextHolder.clearContext();}
    }
}
