import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
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
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.*;
import org.springframework.web.context.request.*;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.framework.aspectj.DataScopeAspect;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.system.service.impl.*;
import io.eforge.enterprise.web.controller.api.v1.system.*;
import io.eforge.enterprise.web.controller.system.SysRoleController;

/** Actual legacy controller/security/transactions/MyBatis. The session callback
 * inherits production registration and observes committed SQL, not Redis writes. */
class RoleOperationMysqlProbe {
    static final long USER=9007199254740995L, ROLE=9007199254740997L, OUTSIDER=9007199254740999L;
    static final Set<String> PERMISSIONS=Set.of("system:role:add","system:role:edit");
    static int assertions,cases;
    static Trace current;
    static void check(boolean value,String message) {assertions++;if(!value)throw new AssertionError(message);}
    static void require(boolean value,String message) {if(!value)throw new AssertionError(message);}
    static DataSource direct() {
        String url=Objects.requireNonNull(System.getenv("EFORGE_ROLE_OPERATION_JDBC_URL"));
        if(!url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/eforge_enterprise\\?.*"))throw new AssertionError("Refusing a non-owned/local SQL target.");
        return new DriverManagerDataSource(url,"root",System.getenv("EFORGE_ROLE_OPERATION_JDBC_PASSWORD"));
    }
    static class Trace {
        final List<String> operations=new ArrayList<>(),writes=new ArrayList<>();
        final Set<Long> connections=new HashSet<>();
    }
    @Intercepts({@Signature(type=Executor.class,method="query",args={MappedStatement.class,Object.class,RowBounds.class,ResultHandler.class}),
            @Signature(type=Executor.class,method="update",args={MappedStatement.class,Object.class})})
    static class Audit implements Interceptor {
        final DataSource source;
        Audit(DataSource source) {this.source=source;}
        @Override public Object intercept(Invocation call) throws Throwable {
            var trace=current;String operation=((MappedStatement)call.getArgs()[0]).getId().replace("io.eforge.enterprise.system.mapper.","");
            if(trace!=null) {
                require(TransactionSynchronizationManager.isActualTransactionActive()&&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Actual role mapper escaped its writable transaction.");
                Connection connection=DataSourceUtils.getConnection(source);
                try(var statement=connection.createStatement();var rows=statement.executeQuery("SELECT DATABASE(),CONNECTION_ID()")) {
                    require(rows.next()&&"eforge_enterprise".equals(rows.getString(1)),"Actual mapper used another schema.");trace.connections.add(rows.getLong(2));
                } finally {DataSourceUtils.releaseConnection(connection,source);}
                trace.operations.add(operation);
            }
            Object result;
            try {result=call.proceed();}catch(InvocationTargetException wrapper) {throw wrapper.getCause();}
            if(trace!=null&&call.getMethod().getName().equals("update"))trace.writes.add(operation);
            return result;
        }
    }
    static final class CommitObserver extends RoleSessionRefresher {
        final List<Set<Long>> publications=new ArrayList<>();
        Map<String,Object> committedRole;
        CommitObserver(PlatformTransactionManager manager) {super(null,null,null,null,null,null,manager);}
        void reset() {publications.clear();committedRole=null;}
        @Override public void refresh(Set<Long> affected) {
            try(Connection connection=direct().getConnection()) {
                connection.setAutoCommit(false);
                try(Statement sql=connection.createStatement()) {
                    sql.setQueryTimeout(4);sql.execute("SET SESSION innodb_lock_wait_timeout=2");
                    try(var rows=sql.executeQuery("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE")) {
                        check(rows.next()&&rows.getLong(1)==100,"Session callback ran before committed root-lock release.");
                    }
                    try(var rows=sql.executeQuery("SELECT CONNECTION_ID()")) {
                        check(rows.next()&&(current==null||!current.connections.contains(rows.getLong(1))),"Session callback reused the mutation SQL connection.");
                    }
                    committedRole=role(new JdbcTemplate(new org.springframework.jdbc.datasource.SingleConnectionDataSource(connection,true)));
                    check(affected.equals(Set.of(USER)),"Session callback lost or rounded the exact affected user identity.");
                    publications.add(Set.copyOf(affected));
                } finally {connection.rollback();}
            } catch(SQLException failure) {throw new AssertionError("Session callback SQL timing check failed.",failure);}
        }
    }
    @Configuration(proxyBeanMethods=false)
    @EnableAspectJAutoProxy(exposeProxy=true,proxyTargetClass=true)
    @EnableTransactionManagement(proxyTargetClass=true)
    @EnableMethodSecurity(proxyTargetClass=true)
    static class Config {
        @Bean DataSource source() {return direct();}
        @Bean PlatformTransactionManager transactionManager(DataSource source) {return new DataSourceTransactionManager(source);}
        @Bean DataScopeAspect dataScope() {return new DataScopeAspect();}
        @Bean(name="ss") PermissionService permissions() {return new PermissionService();}
        @Bean SqlSessionFactory factory(DataSource source) throws Exception {
            var factory=new SqlSessionFactoryBean();factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity,io.eforge.enterprise.system.domain");
            var resolver=new PathMatchingResourcePatternResolver();var resources=new ArrayList<org.springframework.core.io.Resource>();
            for(String name:List.of("SysRole","SysMenu","SysDept","SysUserRole","SysRoleMenu","SysRoleDept"))
                resources.add(resolver.getResource("classpath:mapper/system/"+name+"Mapper.xml"));
            factory.setMapperLocations(resources.toArray(org.springframework.core.io.Resource[]::new));
            var configuration=new org.apache.ibatis.session.Configuration();configuration.setMapUnderscoreToCamelCase(true);configuration.setDefaultStatementTimeout(8);
            configuration.addMapper(DepartmentMutationMapper.class);configuration.addMapper(RoleSelectionMapper.class);
            factory.setConfiguration(configuration);factory.setPlugins(new Audit(source));return factory.getObject();
        }
        @Bean SqlSessionTemplate session(SqlSessionFactory factory) {return new SqlSessionTemplate(factory);}
        @Bean SysRoleMapper roleMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleMapper.class);}
        @Bean SysMenuMapper menuMapper(SqlSessionTemplate session) {return session.getMapper(SysMenuMapper.class);}
        @Bean SysDeptMapper deptMapper(SqlSessionTemplate session) {return session.getMapper(SysDeptMapper.class);}
        @Bean SysRoleMenuMapper roleMenuMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleMenuMapper.class);}
        @Bean SysRoleDeptMapper roleDeptMapper(SqlSessionTemplate session) {return session.getMapper(SysRoleDeptMapper.class);}
        @Bean SysUserRoleMapper userRoleMapper(SqlSessionTemplate session) {return session.getMapper(SysUserRoleMapper.class);}
        @Bean DepartmentMutationMapper mutations(SqlSessionTemplate session) {return session.getMapper(DepartmentMutationMapper.class);}
        @Bean RoleSelectionMapper selections(SqlSessionTemplate session) {return session.getMapper(RoleSelectionMapper.class);}
        @Bean SysRoleServiceImpl legacyRoles() {return new SysRoleServiceImpl();}
        @Bean SysMenuServiceImpl menus() {return new SysMenuServiceImpl();}
        @Bean SysDeptServiceImpl departments() {return new SysDeptServiceImpl();}
        @Bean ISysUserService unusedUsers() {
            // These four operations never use the allocation/list-user collaborator.
            // Fail loudly if that boundary changes; role/department security stays real.
            return (ISysUserService)Proxy.newProxyInstance(ISysUserService.class.getClassLoader(),new Class<?>[]{ISysUserService.class},(proxy,method,args)-> {
                if(method.getDeclaringClass()==Object.class)return switch(method.getName()) {case "toString"->"Unused user-list collaborator";case "hashCode"->System.identityHashCode(proxy);default->proxy==args[0];};
                throw new AssertionError("Role CRUD unexpectedly called "+method.getName());
            });
        }
        @Bean CommitObserver callbacks(PlatformTransactionManager manager) {return new CommitObserver(manager);}
        @Bean RoleService canonical(SysRoleServiceImpl roles,SysMenuServiceImpl menus,SysDeptServiceImpl departments,ISysUserService users,
                RoleSelectionMapper selections,DepartmentMutationMapper mutations,CommitObserver callbacks,PlatformTransactionManager manager) {
            return new RoleService(roles,menus,departments,users,selections,mutations,callbacks,manager);
        }
        @Bean SysRoleController controller() {return new SysRoleController();}
    }
    static void actor(boolean admin,boolean permitted) {
        var user=new SysUser(admin?1L:USER);user.setUserName("owned_operator");user.setDeptId(210L);
        var role=new SysRole(100L);role.setStatus("0");role.setDataScope("3");role.setPermissions(PERMISSIONS);user.setRoles(List.of(role));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new LoginUser(user.getUserId(),210L,user,
                permitted?(admin?Set.of("*:*:*"):PERMISSIONS):Set.of()),null,List.of()));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
    }
    static List<Map<String,Object>> rows(JdbcTemplate sql,String table,String order) {return sql.queryForList("SELECT * FROM "+table+" ORDER BY "+order);}
    static Map<String,Object> role(JdbcTemplate sql) {return sql.queryForMap("SELECT * FROM sys_role WHERE role_id=?",ROLE);}
    static Map<String,List<Map<String,Object>>> snapshot(JdbcTemplate sql) {
        return Map.of("roles",rows(sql,"sys_role","role_id"),"menus",rows(sql,"sys_menu","menu_id"),"departments",rows(sql,"sys_dept","dept_id"),
                "users",rows(sql,"sys_user","user_id"),"userRoles",rows(sql,"sys_user_role","user_id,role_id"),
                "roleMenus",rows(sql,"sys_role_menu","role_id,menu_id"),"roleDepartments",rows(sql,"sys_role_dept","role_id,dept_id"));
    }
    static void initialize(Path repository,JdbcTemplate sql) throws Exception {
        String upstream=Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for(String table:List.of("sys_dept","sys_user","sys_role","sys_menu","sys_user_role","sys_role_menu","sys_role_dept")) {
            var match=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(upstream);
            if(!match.find())throw new AssertionError("Missing upstream role fixture.");sql.execute(match.group());
        }
        var migration=java.util.regex.Pattern.compile("(?is)ALTER TABLE sys_menu\\b.*?;").matcher(Files.readString(repository.resolve("sql/migrations/V001__navigation_identity.sql")));
        if(!migration.find())throw new AssertionError("Missing menu identity migration.");sql.execute(migration.group());
        sql.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name) VALUES(100,0,'0','Owned root'),(210,100,'0,100','Owned branch'),(400,100,'0,100','Outside branch')");
        sql.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,password) VALUES(?,210,'owned_operator','Owned actor','unchanged-hash'),(?,400,'owned_outside','Outside actor','outside-hash')",USER,OUTSIDER);
        sql.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status) VALUES(1,'Administrator','admin',0,'1','0'),(100,'Operator','operator',1,'3','0'),(300,'Outside role','outside',3,'3','0')");
        sql.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status) VALUES(?,'Target','target',2,'2','0')",ROLE);
        sql.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,100),(?,?),(?,300)",USER,USER,ROLE,OUTSIDER);
        sql.update("INSERT INTO sys_menu(menu_id,menu_name,menu_type,menu_key,perms) VALUES(10,'Role edit','F','owned-role-edit','system:role:edit'),(11,'Role add','F','owned-role-add','system:role:add'),(20,'Outside grant','F','owned-outside','outside:grant')");
        reset(sql);
    }
    static void reset(JdbcTemplate sql) {
        sql.execute("DROP TRIGGER IF EXISTS owned_role_operation_failure");
        sql.update("DELETE FROM sys_role_dept");sql.update("DELETE FROM sys_role_menu");
        sql.update("DELETE FROM sys_role WHERE role_id NOT IN (1,100,300,?)",ROLE);
        sql.update("UPDATE sys_role SET role_name='Target',role_key='target',role_sort=2,data_scope='2',menu_check_strictly=1,dept_check_strictly=1,status='0',del_flag='0',create_by='seed',create_time='2020-01-01',update_by='',update_time=NULL,remark='Original remark' WHERE role_id=?",ROLE);
        sql.update("INSERT INTO sys_role_menu(role_id,menu_id) VALUES(100,10),(100,11),(?,10)",ROLE);
        sql.update("INSERT INTO sys_role_dept(role_id,dept_id) VALUES(?,210)",ROLE);
    }
    static SysRole hostile() {
        var input=new SysRole(ROLE);input.setRoleName("Changed");input.setRoleKey("changed");input.setRoleSort(9);input.setStatus("1");input.setRemark("Changed remark");
        input.setDataScope("1");input.setMenuCheckStrictly(false);input.setDeptCheckStrictly(false);input.setMenuIds(new Long[]{11L});input.setDeptIds(new Long[]{400L});
        input.setCreateBy("forged-create");input.setUpdateBy("forged-update");input.setDelFlag("2");input.setCreateTime(new java.util.Date(0));input.setUpdateTime(new java.util.Date(0));
        input.getParams().put("dataScope"," OR 1=1");return input;
    }
    static SysRole scope(String mode,Long... ids) {var input=hostile();input.setDataScope(mode);input.setDeptIds(ids);return input;}
    static AjaxResult invoke(SysRoleController controller,String operation,SysRole input) {
        return switch(operation) {case "add"->controller.add(input);case "edit"->controller.edit(input);case "status"->controller.changeStatus(input);case "scope"->controller.dataScope(input);default->throw new AssertionError("Unknown owned operation.");};
    }
    static void success(AjaxResult result) {check(Integer.valueOf(200).equals(result.get(AjaxResult.CODE_TAG)),"Legacy role operation lost the success envelope.");}
    static void sameExcept(Map<String,Object> before,Map<String,Object> after,Set<String> allowed) {
        var beforeUntouched=new LinkedHashMap<>(before);var afterUntouched=new LinkedHashMap<>(after);
        allowed.forEach(beforeUntouched::remove);allowed.forEach(afterUntouched::remove);
        check(beforeUntouched.equals(afterUntouched),"Operation changed role columns outside its allowed projection.");
    }
    static void unchangedRelations(Map<String,List<Map<String,Object>>> before,JdbcTemplate sql,Set<String> allowed) {
        var after=snapshot(sql);for(String key:before.keySet())if(!allowed.contains(key))check(before.get(key).equals(after.get(key)),"Operation unexpectedly changed "+key);
    }
    static void begin(JdbcTemplate sql,CommitObserver callbacks,boolean admin) {current=null;reset(sql);callbacks.reset();actor(admin,true);current=new Trace();}
    static void accepted(CommitObserver callbacks,JdbcTemplate sql,boolean creates) {
        check(!current.operations.isEmpty()&&current.operations.get(0).equals("DepartmentMutationMapper.lockRoot"),"Role operation did not lock before scope/read/write.");
        check(current.connections.size()==1&&!current.writes.isEmpty(),"Role operation did not use one real mutation transaction.");
        check(callbacks.publications.equals(creates?List.of():List.of(Set.of(USER))),"Wrong session callback count or identities.");
        if(!creates)check(role(sql).equals(callbacks.committedRole),"Session callback did not observe the final committed role row.");
        check(!TransactionSynchronizationManager.isActualTransactionActive(),"Role transaction leaked after return.");
    }
    static void rejected(SysRoleController controller,String operation,SysRole input,int expected,JdbcTemplate sql,CommitObserver callbacks) {
        var before=snapshot(sql);current=new Trace();callbacks.reset();
        try {invoke(controller,operation,input);throw new AssertionError("Invalid role operation unexpectedly succeeded.");}
        catch(AccessDeniedException failure) {check(expected==403,"Unexpected access denial classification.");}
        catch(ServiceException failure) {check(Objects.equals(expected,failure.getCode()),"Unexpected compatibility error status: "+failure.getCode());}
        check(before.equals(snapshot(sql)),"Rejected role operation changed complete SQL rows/links/audit.");
        check(current.writes.isEmpty()&&callbacks.publications.isEmpty(),"Rejected batch wrote partially or published authorization.");
        check(!TransactionSynchronizationManager.isActualTransactionActive(),"Rejected role operation leaked a transaction.");
    }
    static void pass(String text) {cases++;System.out.println("PASS CASE: "+text);}
    static void fields(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var controller=context.getBean(SysRoleController.class);var callbacks=context.getBean(CommitObserver.class);
        begin(sql,callbacks,false);var before=snapshot(sql);var original=role(sql);success(controller.edit(hostile()));var after=role(sql);
        sameExcept(original,after,Set.of("role_name","role_key","role_sort","status","remark","menu_check_strictly","update_by","update_time"));
        check("Changed".equals(after.get("role_name"))&&"changed".equals(after.get("role_key"))&&((Number)after.get("role_sort")).intValue()==9&&"1".equals(after.get("status"))&&"Changed remark".equals(after.get("remark")),"Legitimate edit fields were not persisted.");
        check("owned_operator".equals(after.get("update_by")),"Edit accepted forged actor audit.");
        check(sql.queryForList("SELECT menu_id FROM sys_role_menu WHERE role_id=?",Long.class,ROLE).equals(List.of(11L)),"Edit did not replace only the target menu relations.");
        unchangedRelations(before,sql,Set.of("roles","roleMenus"));accepted(callbacks,sql,false);pass("ordinary edit preserves stored scope/dept flags, exact role ID, unrelated relationships and trusted audit");

        begin(sql,callbacks,false);before=snapshot(sql);original=role(sql);success(controller.changeStatus(hostile()));after=role(sql);
        sameExcept(original,after,Set.of("status","update_by","update_time"));check("1".equals(after.get("status"))&&"owned_operator".equals(after.get("update_by")),"Status/trusted audit did not persist.");
        unchangedRelations(before,sql,Set.of("roles"));accepted(callbacks,sql,false);pass("status ignores full hostile DTO including both primitive flags and every relationship");

        begin(sql,callbacks,false);before=snapshot(sql);original=role(sql);success(controller.dataScope(scope("2",210L)));after=role(sql);
        sameExcept(original,after,Set.of("data_scope","dept_check_strictly","update_by","update_time"));
        check("2".equals(after.get("data_scope"))&&"owned_operator".equals(after.get("update_by")),"Scope/trusted audit did not persist.");
        unchangedRelations(before,sql,Set.of("roles","roleDepartments"));accepted(callbacks,sql,false);pass("scope changes only allowed scope fields and keeps all menu/user relations");

        begin(sql,callbacks,false);before=snapshot(sql);success(controller.add(hostile()));
        var created=sql.queryForMap("SELECT * FROM sys_role WHERE role_key='changed'");long generated=((Number)created.get("role_id")).longValue();
        check(generated>ROLE&&generated!=ROLE,"Create borrowed the supplied target identity or rounded a generated long.");
        check("1".equals(created.get("data_scope"))&&Boolean.TRUE.equals(created.get("dept_check_strictly")),"Create did not use canonical scope/department defaults.");
        check("owned_operator".equals(created.get("create_by"))&&"0".equals(created.get("del_flag"))&&!Objects.equals(created.get("create_time"),new java.util.Date(0)),"Create accepted forged audit/deletion state.");
        check(sql.queryForList("SELECT menu_id FROM sys_role_menu WHERE role_id=?",Long.class,generated).equals(List.of(11L))&&sql.queryForObject("SELECT COUNT(*) FROM sys_role_dept WHERE role_id=?",Integer.class,generated)==0,"Create persisted injected department grants or lost allowed menus.");
        check(before.get("roles").equals(sql.queryForList("SELECT * FROM sys_role WHERE role_id<>? ORDER BY role_id",generated)),"Create modified an existing role.");
        unchangedRelations(before,sql,Set.of("roles","roleMenus"));accepted(callbacks,sql,true);pass("create ignores borrowed identity/scope/dept/audit; generated long and permitted menu persist");
    }
    static void denials(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var controller=context.getBean(SysRoleController.class);var callbacks=context.getBean(CommitObserver.class);
        begin(sql,callbacks,false);rejected(controller,"scope",scope("2",210L,400L),403,sql,callbacks);pass("mixed in-scope/out-of-scope department batch has zero writes");
        begin(sql,callbacks,false);rejected(controller,"scope",scope("2",210L,999999L),403,sql,callbacks);pass("ordinary missing department fails closed at actual DataScope before persistence");
        begin(sql,callbacks,true);rejected(controller,"scope",scope("2",210L,999999L),404,sql,callbacks);pass("admin missing department is a safe not-found after existence check, zero writes");
        for(SysRole request:List.of(scope("1",210L),scope("6"),scope("2",210L,210L),scope("2",0L),scope("2",(Long[])null),scope(null))) {
            begin(sql,callbacks,false);rejected(controller,"scope",request,400,sql,callbacks);
        }
        pass("invalid mode, non-custom grants, duplicate/nonpositive/null departments are rejected before any writes");
        for(String operation:List.of("add","edit","status","scope")) {
            begin(sql,callbacks,false);actor(false,false);rejected(controller,operation,operation.equals("scope")?scope("2",210L):hostile(),403,sql,callbacks);
            check(current.operations.isEmpty(),"Missing method permission reached the shared lock or SQL.");
        }
        pass("all four legacy methods deny no-permission principal before SQL");
        for(String operation:List.of("edit","status","scope")) {
            begin(sql,callbacks,false);var input=operation.equals("scope")?scope("2",210L):hostile();input.setRoleId(300L);rejected(controller,operation,input,403,sql,callbacks);
        }
        pass("ordinary actor cannot mutate an existing role bound exclusively outside department scope");
        for(long target:List.of(1L,999999L)) {
            begin(sql,callbacks,true);var input=hostile();input.setRoleId(target);rejected(controller,"status",input,target==1?409:404,sql,callbacks);
        }
        pass("administrator role protected and missing role safe not-found");
        for(String status:List.of("","2","disabled")) {begin(sql,callbacks,false);var input=hostile();input.setStatus(status);rejected(controller,"status",input,400,sql,callbacks);}
        pass("status values validated independently of permissive legacy DTO");
        for(String mode:List.of("1","2","3","4","5")) {
            begin(sql,callbacks,false);success(controller.dataScope(mode.equals("2")?scope(mode,210L):scope(mode)));
            check(mode.equals(role(sql).get("data_scope")),"Valid original data-scope mode did not persist.");
            check(sql.queryForList("SELECT dept_id FROM sys_role_dept WHERE role_id=? ORDER BY dept_id",Long.class,ROLE).equals(mode.equals("2")?List.of(210L):List.of()),"Non-custom scope retained stale departments.");
            accepted(callbacks,sql,false);
        }
        pass("all five existing modes remain supported with correct department relation semantics");
    }
    static void rollback(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var controller=context.getBean(SysRoleController.class);var callbacks=context.getBean(CommitObserver.class);
        for(String operation:List.of("scope","edit","add")) {
            begin(sql,callbacks,false);var before=snapshot(sql);String table=operation.equals("scope")?"sys_role_dept":"sys_role_menu";
            sql.execute("CREATE TRIGGER owned_role_operation_failure BEFORE INSERT ON "+table+" FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned role relation failure'");
            try {invoke(controller,operation,operation.equals("scope")?scope("2",210L):hostile());throw new AssertionError("Actual SQL trigger did not fail the role write.");}
            catch(org.springframework.dao.DataAccessException expected) {check(true,"Actual SQL exception observed.");}
            check(current.writes.contains(operation.equals("add")?"SysRoleMapper.insertRole":"SysRoleMapper.updateRole"),"Fault was not after a real persisted role write.");
            if(!operation.equals("add"))check(current.writes.contains(operation.equals("scope")?"SysRoleDeptMapper.deleteRoleDeptByRoleId":"SysRoleMenuMapper.deleteRoleMenuByRoleId"),"Fault was not after actual relation deletion.");
            check(before.equals(snapshot(sql))&&callbacks.publications.isEmpty(),"Real SQL failure did not roll back complete metadata/audit/relations or published before rollback.");
            sql.execute("DROP TRIGGER owned_role_operation_failure");current=new Trace();callbacks.reset();
            success(invoke(controller,operation,operation.equals("scope")?scope("2",210L):hostile()));accepted(callbacks,sql,operation.equals("add"));
            pass(operation+" real relation INSERT fault rolls back previous role/link writes and audit; identical request retries successfully");
        }
    }
    public static void main(String[] args) throws Exception {
        var sql=new JdbcTemplate(direct());initialize(Path.of(args[0]),sql);
        try(var context=new AnnotationConfigApplicationContext(Config.class)) {
            fields(context,sql);denials(context,sql);rollback(context,sql);
            current=null;reset(sql);check(sql.queryForObject("SELECT COUNT(*) FROM sys_user WHERE user_id IN (?,?)",Integer.class,USER,OUTSIDER)==2,"Account identities changed.");
            System.out.println("PASS: "+cases+" cases / "+assertions+" actual MySQL role-operation assertions; real method security, DataScope, mapper writes, rollback/retry and post-commit SQL callback. Redis persistence is not exercised.");
        } finally {current=null;SecurityContextHolder.clearContext();RequestContextHolder.resetRequestAttributes();}
    }
}
