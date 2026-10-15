import java.lang.reflect.InvocationTargetException;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.*;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.framework.aspectj.DataScopeAspect;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.impl.SysDeptServiceImpl;
import io.eforge.enterprise.web.controller.system.SysDeptController;

/** Owned MySQL only: real Spring transactions/method security/DataScope and MyBatis.
 * Faults are server-side triggers, never mocked mapper failures. This is not HTTP
 * or Redis coverage. Production annotations determine the transaction boundary. */
class DepartmentMutationMysqlProbe {
    static final long USER=9007199254740995L;
    static final AtomicInteger assertions=new AtomicInteger();
    static final ThreadLocal<Trace> traces=new ThreadLocal<>();
    static void require(boolean condition,String message) {if(!condition)throw new AssertionError(message);}
    static void check(boolean condition,String message) {assertions.incrementAndGet();require(condition,message);}
    static DataSource direct() {
        String url=Objects.requireNonNull(System.getenv("EFORGE_DEPT_MUTATION_JDBC_URL"));
        require(url.startsWith("jdbc:mysql://127.0.0.1:")&&url.contains("/eforge_enterprise?"),"Unexpected database ownership boundary.");
        return new DriverManagerDataSource(url,"root",System.getenv("EFORGE_DEPT_MUTATION_JDBC_PASSWORD"));
    }
    static final class Trace {
        final boolean mutation;
        final List<String> operations=new CopyOnWriteArrayList<>(),completedWrites=new CopyOnWriteArrayList<>();
        final Set<Long> connections=ConcurrentHashMap.newKeySet();
        final CountDownLatch rootStarted=new CountDownLatch(1);
        volatile long connection;
        Trace(boolean mutation) {this.mutation=mutation;}
    }
    @Intercepts({@Signature(type=Executor.class,method="query",args={MappedStatement.class,Object.class,RowBounds.class,ResultHandler.class}),
                 @Signature(type=Executor.class,method="update",args={MappedStatement.class,Object.class})})
    static final class Audit implements Interceptor {
        final DataSource source;
        Audit(DataSource source) {this.source=source;}
        @Override public Object intercept(Invocation invocation) throws Throwable {
            Trace trace=traces.get();
            String operation=((MappedStatement)invocation.getArgs()[0]).getId();
            operation=operation.substring(operation.lastIndexOf('.')+1);
            if(trace!=null) {
                if(trace.mutation) require(TransactionSynchronizationManager.isActualTransactionActive()
                        &&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Production department mutation escaped its writable transaction.");
                Connection connection=DataSourceUtils.getConnection(source);
                try(var statement=connection.createStatement();var row=statement.executeQuery("SELECT DATABASE(), CONNECTION_ID()")) {
                    require(row.next()&&"eforge_enterprise".equals(row.getString(1)),"Mapper used an unintended schema.");
                    trace.connection=row.getLong(2);trace.connections.add(trace.connection);
                } finally {DataSourceUtils.releaseConnection(connection,source);}
                trace.operations.add(operation);
                if(operation.equals("lockRoot"))trace.rootStarted.countDown();
            }
            Object result;
            try {result=invocation.proceed();}catch(InvocationTargetException wrapper) {throw wrapper.getCause();}
            if(trace!=null&&invocation.getMethod().getName().equals("update"))trace.completedWrites.add(operation);
            return result;
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
        @Bean(name="ss") PermissionService permission() {return new PermissionService();}
        @Bean SqlSessionFactory factory(DataSource source) throws Exception {
            var factory=new SqlSessionFactoryBean();factory.setDataSource(source);
            factory.setTypeAliasesPackage("io.eforge.enterprise.common.core.domain.entity");
            var resolver=new PathMatchingResourcePatternResolver();
            factory.setMapperLocations(resolver.getResource("classpath:mapper/system/SysDeptMapper.xml"),
                    resolver.getResource("classpath:mapper/system/SysRoleMapper.xml"));
            var configuration=new org.apache.ibatis.session.Configuration();configuration.setDefaultStatementTimeout(12);
            configuration.addMapper(DepartmentMutationMapper.class);factory.setConfiguration(configuration);
            factory.setPlugins(new Audit(source));return factory.getObject();
        }
        @Bean SqlSessionTemplate session(SqlSessionFactory factory) {return new SqlSessionTemplate(factory);}
        @Bean SysDeptMapper departments(SqlSessionTemplate session) {return session.getMapper(SysDeptMapper.class);}
        @Bean SysRoleMapper roles(SqlSessionTemplate session) {return session.getMapper(SysRoleMapper.class);}
        @Bean DepartmentMutationMapper mutations(SqlSessionTemplate session) {return session.getMapper(DepartmentMutationMapper.class);}
        @Bean SysDeptServiceImpl service() {return new SysDeptServiceImpl();}
        @Bean SysDeptController controller() {return new SysDeptController();}
    }
    static void actor(String scope,boolean matchingRole,boolean enabled) {
        var user=new SysUser(scope==null?1L:USER);user.setUserName("owned_actor");user.setDeptId(200L);
        var role=new SysRole(100L);role.setDataScope(scope);role.setStatus(enabled?"0":"1");
        role.setPermissions(matchingRole?Set.of("system:dept:list","system:dept:add","system:dept:edit","system:dept:remove"):Set.of("unrelated:permission"));user.setRoles(scope==null?List.of():List.of(role));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new LoginUser(user.getUserId(),200L,user,Set.of("*:*:*")),null,List.of()));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
    }
    static void clear() {traces.remove();SecurityContextHolder.clearContext();RequestContextHolder.resetRequestAttributes();}
    static SysDept move() {
        var department=new SysDept();department.setDeptId(200L);department.setParentId(300L);department.setDeptName("Moved branch");
        department.setStatus("0");department.setOrderNum(9);department.setLeader("New leader");
        department.setPhone("13900000000");department.setEmail("changed@example.test");department.setUpdateBy("owned_actor");return department;
    }
    static SysDept added() {
        var department=new SysDept();department.setDeptId(700L);department.setParentId(300L);department.setDeptName("Created branch");
        department.setOrderNum(7);department.setStatus("0");return department;
    }
    static void successful(AjaxResult result) {check(Integer.valueOf(200).equals(result.get(AjaxResult.CODE_TAG)),"Legacy operation did not return its original success envelope.");}
    static List<Map<String,Object>> rows(JdbcTemplate sql,String table,String key) {return sql.queryForList("SELECT * FROM "+table+" ORDER BY "+key);}
    static Map<String,List<Map<String,Object>>> accountRows(JdbcTemplate sql) {
        return Map.of("users",rows(sql,"sys_user","user_id"),"roles",rows(sql,"sys_role","role_id"),
                "assignments",rows(sql,"sys_user_role","user_id,role_id"),"scope",rows(sql,"sys_role_dept","role_id,dept_id"));
    }
    static void initialize(Path repository,JdbcTemplate sql) throws Exception {
        String upstream=Files.readString(repository.resolve("sql/upstream/ry_20260417.sql"));
        for(String table:List.of("sys_dept","sys_user","sys_role","sys_user_role","sys_role_dept")) {
            var match=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(upstream);
            require(match.find(),"Missing upstream fixture table.");sql.execute(match.group());
        }
        sql.update("INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,password) VALUES(?,200,'owned_actor','Owned account','unchanged-hash')",USER);
        sql.update("INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status) VALUES(100,'Owned scope','owned_scope',1,'2','0')");
        sql.update("INSERT INTO sys_user_role(user_id,role_id) VALUES(?,100)",USER);
        sql.update("INSERT INTO sys_role_dept(role_id,dept_id) VALUES(100,210),(100,400)");
        reset(sql);
    }
    static void reset(JdbcTemplate sql) {
        sql.execute("DROP TRIGGER IF EXISTS owned_department_failure");
        sql.update("DELETE FROM sys_dept");
        sql.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name,order_num,status,leader,phone,email,create_by,create_time,update_by,update_time) VALUES"
                +"(100,0,'0','Root',0,'0','Root leader','100','root@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(200,100,'0,100','Old branch',1,'0','Old leader','200','old@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(210,200,'0,100,200','Child',2,'0','Child leader','210','child@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(211,210,'0,100,200,210','Grandchild',3,'0','Grandchild leader','211','grandchild@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(300,100,'0,100','New parent',4,'1','Parent leader','300','parent@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(400,100,'0,100','Other parent',5,'0','Other leader','400','other@example.test','seed','2020-01-01','seed','2020-01-02'),"
                +"(600,100,'0,100','Empty leaf',6,'0','Leaf leader','600','leaf@example.test','seed','2020-01-01','seed','2020-01-02')");
    }
    static boolean expectedFault(Throwable error) {
        Set<Throwable> seen=Collections.newSetFromMap(new IdentityHashMap<>());
        for(Throwable current=error;current!=null&&seen.add(current);current=current.getCause())
            if(current instanceof SQLException sql&&"45000".equals(sql.getSQLState())&&sql.getMessage().contains("owned_department_fault"))return true;
        return false;
    }
    static void fault(JdbcTemplate sql,boolean parent) {
        String condition=parent?"OLD.dept_id=300 AND OLD.status='1' AND NEW.status='0'":"OLD.dept_id=200 AND NEW.parent_id=300";
        // JDBC submits this complete trigger as one statement: CLI DELIMITER is not SQL.
        sql.execute("CREATE TRIGGER owned_department_failure BEFORE UPDATE ON sys_dept FOR EACH ROW BEGIN IF "+condition
                +" THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned_department_fault'; END IF; END");
    }
    static void ancestry(JdbcTemplate sql,long id,long parent,String path) {
        Map<String,Object> row=sql.queryForMap("SELECT parent_id,ancestors FROM sys_dept WHERE dept_id=?",id);
        check(((Number)row.get("parent_id")).longValue()==parent&&path.equals(row.get("ancestors")),"Incorrect committed hierarchy for department "+id);
    }
    static void rollbackCases(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var service=context.getBean(ISysDeptService.class);var controller=context.getBean(SysDeptController.class);
        for(boolean legacy:List.of(false,true))for(boolean parent:List.of(false,true)) {
            reset(sql);var before=rows(sql,"sys_dept","dept_id");var accounts=accountRows(sql);fault(sql,parent);
            actor(null,true,true);var trace=new Trace(true);traces.set(trace);
            RuntimeException failure;
            try {if(legacy)controller.edit(move());else service.updateDept(move());throw new AssertionError("Expected real database trigger failure.");}
            catch(RuntimeException error) {failure=error;}
            finally {clear();sql.execute("DROP TRIGGER owned_department_failure");}
            check(expectedFault(failure),"The mutation did not fail at the intended real SQL trigger.");
            check(trace.connections.size()==1,"Multi-step mutation used multiple SQL connections.");
            check(trace.completedWrites.contains("updateDeptChildren")&&(!parent||trace.completedWrites.contains("updateDept")),"The trigger did not run after the earlier hierarchy write(s).");
            if(legacy)check(trace.operations.get(0).equals("lockRoot"),"Legacy edit performed business reads before the shared root lock.");
            check(before.equals(rows(sql,"sys_dept","dept_id")),"SQL failure left partially committed department rows.");
            check(accounts.equals(accountRows(sql)),"SQL failure changed account/role/data-scope rows.");
            actor(null,true,true);traces.set(new Trace(true));
            try {if(legacy)successful(controller.edit(move()));else check(service.updateDept(move())==1,"Service retry did not update the node.");}
            finally {clear();}
            ancestry(sql,200,300,"0,100,300");ancestry(sql,210,200,"0,100,300,200");ancestry(sql,211,210,"0,100,300,200,210");
            check("0".equals(sql.queryForObject("SELECT status FROM sys_dept WHERE dept_id=300",String.class)),"Successful retry did not preserve original ancestor-enable behavior.");
            check("Moved branch|New leader|13900000000|changed@example.test|9".equals(sql.queryForObject("SELECT CONCAT(dept_name,'|',leader,'|',phone,'|',email,'|',order_num) FROM sys_dept WHERE dept_id=200",String.class)),"Retry lost requested field values.");
            check(accounts.equals(accountRows(sql)),"Retry changed account/role/data-scope rows.");
            System.out.println("PASS CASE: "+(legacy?"legacy controller":"direct service")+" "+(parent?"ancestor status":"node update")+" SQL failure: complete rows rolled back, one connection, retry committed exact hierarchy");
        }
    }
    static void waitForLock(JdbcTemplate observer,long connection) throws Exception {
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(7);
        while(System.nanoTime()<deadline) {
            Integer count=observer.queryForObject("SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.threads t ON t.THREAD_ID=w.REQUESTING_THREAD_ID WHERE t.PROCESSLIST_ID=?",Integer.class,connection);
            if(count!=null&&count>0)return;
            Thread.sleep(25);
        }
        throw new AssertionError("The concurrent controller did not establish an actual InnoDB lock wait.");
    }
    static void concurrentCases(AnnotationConfigApplicationContext context,JdbcTemplate sql) throws Exception {
        var controller=context.getBean(SysDeptController.class);
        for(boolean add:List.of(false,true)) {
            reset(sql);var accounts=accountRows(sql);var original=rows(sql,"sys_dept","dept_id");
            var trace=new Trace(true);ExecutorService worker=Executors.newSingleThreadExecutor();
            Future<?> pending=null;
            try(Connection blocker=direct().getConnection()) {
                blocker.setAutoCommit(false);
                try(var statement=blocker.createStatement()) {
                    try(var locked=statement.executeQuery("SELECT dept_id FROM sys_dept WHERE parent_id=0 ORDER BY dept_id LIMIT 1 FOR UPDATE")) {require(locked.next(),"Owned root disappeared.");}
                    statement.executeUpdate("UPDATE sys_dept SET parent_id=400,ancestors='0,100,400',status='0' WHERE dept_id=300");
                }
                pending=worker.submit(()-> {
                    actor(null,true,true);traces.set(trace);
                    try {successful(add?controller.add(added()):controller.edit(move()));}
                    finally {clear();}
                });
                check(trace.rootStarted.await(7,TimeUnit.SECONDS),"Legacy writer did not reach the shared root lock.");
                waitForLock(sql,trace.connection);
                check(!pending.isDone()&&trace.operations.equals(List.of("lockRoot")),"A blocked legacy writer read hierarchy before obtaining the root lock.");
                check(original.equals(rows(sql,"sys_dept","dept_id")),"An independent reader observed a partially committed hierarchy.");
                blocker.commit();pending.get(12,TimeUnit.SECONDS);
                check(trace.connections.size()==1,"Lock and downstream reads/writes used different SQL connections.");
                ancestry(sql,300,400,"0,100,400");
                if(add) {
                    List<Long> created=sql.queryForList("SELECT dept_id FROM sys_dept WHERE dept_name='Created branch'",Long.class);
                    check(created.size()==1&&created.get(0)!=700L,"Legacy add must allocate its own identity rather than persist the caller-supplied ID.");
                    ancestry(sql,created.get(0),300,"0,100,400,300");
                }
                else {ancestry(sql,200,300,"0,100,400,300");ancestry(sql,210,200,"0,100,400,300,200");ancestry(sql,211,210,"0,100,400,300,200,210");}
                check(accounts.equals(accountRows(sql)),"Concurrent hierarchy mutation changed account/role/data-scope rows.");
                System.out.println("PASS CASE: legacy "+(add?"add":"edit")+" actual InnoDB root lock wait; no preceding business read; committed parent ancestry used");
            } finally {
                if(pending!=null&&!pending.isDone())pending.cancel(true);
                worker.shutdownNow();require(worker.awaitTermination(15,TimeUnit.SECONDS),"Owned writer did not terminate.");
            }
        }
    }
    static void otherWriters(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var controller=context.getBean(SysDeptController.class);
        for(boolean remove:List.of(false,true)) {
            reset(sql);var accounts=accountRows(sql);actor(null,true,true);var trace=new Trace(true);traces.set(trace);
            try {successful(remove?controller.remove(600L):controller.updateSort(Map.of("deptIds","200,210","orderNums","71,72")));}
            finally {clear();}
            check(trace.operations.get(0).equals("lockRoot")&&trace.connections.size()==1,"Legacy delete/sort missed the transaction-scoped read-before-write root lock.");
            check(remove?"2".equals(sql.queryForObject("SELECT del_flag FROM sys_dept WHERE dept_id=600",String.class))
                    :sql.queryForList("SELECT order_num FROM sys_dept WHERE dept_id IN(200,210) ORDER BY dept_id",Integer.class).equals(List.of(71,72)),"Legacy delete/sort changed its original persistence behavior.");
            check(accounts.equals(accountRows(sql)),"Legacy delete/sort changed account/role/data-scope rows.");
        }
        System.out.println("PASS CASE: remaining legacy delete/sort writers use the shared transaction/root boundary");
    }
    static void scopes(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        reset(sql);var before=rows(sql,"sys_dept","dept_id");var accounts=accountRows(sql);
        var controller=context.getBean(SysDeptController.class);
        var expected=Map.of("1",Set.of(100L,200L,210L,211L,300L,400L,600L),"2",Set.of(210L,400L),
                "3",Set.of(200L),"4",Set.of(200L,210L,211L),"5",Set.<Long>of());
        for(String scope:List.of("1","2","3","4","5")) {
            actor(scope,true,true);
            try {
                // Controller permission evaluation sets the original DataScope permission context.
                @SuppressWarnings("unchecked") List<SysDept> result=(List<SysDept>)controller.list(new SysDept()).get(AjaxResult.DATA_TAG);
                check(result.stream().map(SysDept::getDeptId).collect(java.util.stream.Collectors.toSet()).equals(expected.get(scope)),"Actual SQL data-scope behavior changed for mode "+scope);
            } finally {clear();}
        }
        for(boolean roleEnabled:List.of(false,true)) {
            actor("1",!roleEnabled,roleEnabled);
            try {
                @SuppressWarnings("unchecked") List<SysDept> result=(List<SysDept>)controller.list(new SysDept()).get(AjaxResult.DATA_TAG);
                check(result.isEmpty(),"Disabled or nonmatching role escaped data-scope filtering.");
            } finally {clear();}
        }
        actor("3",true,true);traces.set(new Trace(true));
        try {
            SysDept forbidden=move();forbidden.setDeptId(400L);forbidden.setParentId(100L);
            try {controller.edit(forbidden);throw new AssertionError("Out-of-scope legacy edit was accepted.");}
            catch(ServiceException expectedFailure) {check("没有权限访问部门数据！".equals(expectedFailure.getMessage()),"Original data-scope rejection changed.");}
        } finally {clear();}
        check(before.equals(rows(sql,"sys_dept","dept_id"))&&accounts.equals(accountRows(sql)),"Read/data-scope checks changed owned rows.");
        System.out.println("PASS CASE: actual DataScope SQL modes 1-5, disabled/nonmatching roles, denied legacy write preserved");
    }
    static SysDept requested(long id,Long parent) {
        SysDept patch=move();patch.setDeptId(id);patch.setParentId(parent);patch.setDeptName("Scoped write");return patch;
    }
    static void rejected(JdbcTemplate sql,String label,String scope,java.util.function.Supplier<AjaxResult> action) {
        var before=rows(sql,"sys_dept","dept_id");var accounts=accountRows(sql);var trace=new Trace(true);
        actor(scope,true,true);traces.set(trace);
        try {
            try {check(!Integer.valueOf(200).equals(action.get().get(AjaxResult.CODE_TAG)),label+" returned success.");}
            catch(ServiceException | org.springframework.security.access.AccessDeniedException expected) {
                check(true,label+" rejected with the original business/authorization exception.");
            }
        } finally {clear();}
        check(!trace.operations.isEmpty()&&trace.operations.get(0).equals("lockRoot")&&trace.connections.size()==1,label+" did not begin inside the shared root-lock transaction.");
        check(trace.completedWrites.isEmpty(),label+" wrote SQL before complete preflight validation.");
        check(before.equals(rows(sql,"sys_dept","dept_id")),label+" changed department content or audit fields.");
        check(accounts.equals(accountRows(sql)),label+" changed accounts, roles or scope relations.");
    }
    static void authorizationCases(AnnotationConfigApplicationContext context,JdbcTemplate sql) {
        var controller=context.getBean(SysDeptController.class);reset(sql);
        SysDept outside=requested(210,400L);outside.setAncestors("0,100,300");
        rejected(sql,"changed parent outside scope","4",()->controller.edit(outside));
        rejected(sql,"descendant cycle",null,()->controller.edit(requested(200,211L)));
        rejected(sql,"self parent",null,()->controller.edit(requested(200,200L)));
        for(long parent:List.of(0L,999999L)) {
            SysDept forged=requested(210,parent);forged.setAncestors("0,100,300");
            rejected(sql,"invented parent "+parent,null,()->controller.edit(forged));
        }
        SysDept outsideAdd=added();outsideAdd.setParentId(400L);
        rejected(sql,"create under an outside parent","4",()->controller.add(outsideAdd));
        rejected(sql,"mixed visible/outside sort","4",()->controller.updateSort(Map.of("deptIds","210,600","orderNums","71,72")));
        rejected(sql,"late missing sort target",null,()->controller.updateSort(Map.of("deptIds","210,999999","orderNums","71,72")));
        rejected(sql,"mismatched sort arrays",null,()->controller.updateSort(Map.of("deptIds","210,211","orderNums","71")));
        rejected(sql,"outside delete","4",()->controller.remove(600L));
        rejected(sql,"root delete",null,()->controller.remove(100L));
        check("1".equals(sql.queryForObject("SELECT status FROM sys_dept WHERE dept_id=300",String.class)),"Rejected forged ancestry enabled an unrelated department.");
        System.out.println("PASS CASE: real SQL scope/parent existence/cycle/root checks and all-target sort preflight reject without any write or audit change");

        for(boolean absentParent:List.of(false,true)) {
            reset(sql);var accounts=accountRows(sql);var parentBefore=sql.queryForMap("SELECT * FROM sys_dept WHERE dept_id=100");
            var unrelatedBefore=rowsWhere(sql,"dept_id NOT IN (100,200,210,211)");
            var created=sql.queryForMap("SELECT create_by,create_time,del_flag FROM sys_dept WHERE dept_id=200");
            SysDept patch=requested(200,absentParent?null:100L);patch.setAncestors("0,100,300");
            patch.setCreateBy("forged-actor");patch.setCreateTime(new java.util.Date(0));patch.setDelFlag("2");patch.setUpdateBy("forged-actor");
            actor("3",true,true);var trace=new Trace(true);traces.set(trace);
            try {successful(controller.edit(patch));} finally {clear();}
            ancestry(sql,200,100,"0,100");ancestry(sql,210,200,"0,100,200");ancestry(sql,211,210,"0,100,200,210");
            check(parentBefore.equals(sql.queryForMap("SELECT * FROM sys_dept WHERE dept_id=100")),"Retained outside parent content or audit fields changed.");
            check(created.equals(sql.queryForMap("SELECT create_by,create_time,del_flag FROM sys_dept WHERE dept_id=200")),"Edit accepted client creation/deletion fields.");
            check("owned_actor".equals(sql.queryForObject("SELECT update_by FROM sys_dept WHERE dept_id=200",String.class)),"Edit trusted the submitted audit actor.");
            check(unrelatedBefore.equals(rowsWhere(sql,"dept_id NOT IN (100,200,210,211)")),"Retained parent update touched unrelated/forged ancestors.");
            check(accounts.equals(accountRows(sql)),"Retained parent update changed account/scope rows.");
            check(trace.operations.get(0).equals("lockRoot")&&trace.connections.size()==1,"Retained parent update escaped shared transaction.");
        }
        System.out.println("PASS CASE: original or omitted parent outside scope is preserved, forged ancestry/identity audit values cannot redirect writes");

        reset(sql);var rootBefore=sql.queryForMap("SELECT parent_id,ancestors,create_by,create_time,del_flag FROM sys_dept WHERE dept_id=100");
        var otherBefore=rowsWhere(sql,"dept_id<>100");var accounts=accountRows(sql);
        SysDept root=requested(100,0L);root.setAncestors("0,300");root.setDelFlag("2");root.setCreateBy("forged-root");
        actor(null,true,true);traces.set(new Trace(true));
        try {successful(controller.edit(root));} finally {clear();}
        check(rootBefore.equals(sql.queryForMap("SELECT parent_id,ancestors,create_by,create_time,del_flag FROM sys_dept WHERE dept_id=100")),"Root edit changed derived hierarchy or protected creation/deletion fields.");
        check(otherBefore.equals(rowsWhere(sql,"dept_id<>100")),"Root forged ancestry enabled or changed unrelated rows.");
        check(accounts.equals(accountRows(sql)),"Root update changed account/scope rows.");

        reset(sql);var existing=rows(sql,"sys_dept","dept_id");accounts=accountRows(sql);
        SysDept create=added();create.setDeptId(200L);create.setParentId(400L);create.setAncestors("0,300");create.setDelFlag("2");
        create.setCreateBy("forged-creator");create.setUpdateBy("forged-updater");create.setCreateTime(new java.util.Date(0));create.setUpdateTime(new java.util.Date(0));
        actor(null,true,true);traces.set(new Trace(true));
        try {successful(controller.add(create));} finally {clear();}
        List<Map<String,Object>> inserted=sql.queryForList("SELECT * FROM sys_dept WHERE dept_name='Created branch'");
        check(inserted.size()==1,"Create did not insert exactly one generated identity.");
        long id=((Number)inserted.get(0).get("dept_id")).longValue();
        check(id!=200L,"Create persisted the supplied existing primary key.");
        ancestry(sql,id,400,"0,100,400");
        check(existing.equals(rowsWhere(sql,"dept_id<>"+id)),"Create changed any preexisting department row.");
        check("0".equals(inserted.get(0).get("del_flag"))&&"owned_actor".equals(inserted.get(0).get("create_by")),"Create accepted deletion flag or forged actor.");
        check(!"forged-updater".equals(inserted.get(0).get("update_by"))&&inserted.get(0).get("update_time")==null,"Create accepted submitted update audit fields.");
        check(accounts.equals(accountRows(sql)),"Create changed account/scope rows.");
        System.out.println("PASS CASE: root edit keeps trusted ancestry and create ignores caller identity/derived/audit/deletion fields");

        reset(sql);sql.update("INSERT INTO sys_dept(dept_id,parent_id,ancestors,dept_name,order_num,status) VALUES(212,200,'0,100,200','Sibling',8,'0')");
        accounts=accountRows(sql);var siblingBefore=rowsWhere(sql,"dept_id NOT IN (100,200,211,212)");
        actor("4",true,true);traces.set(new Trace(true));
        try {successful(controller.edit(requested(211,212L)));} finally {clear();}
        ancestry(sql,211,212,"0,100,200,212");
        check(siblingBefore.equals(rowsWhere(sql,"dept_id NOT IN (100,200,211,212)")),"Legal sibling move changed unrelated departments.");
        check(accounts.equals(accountRows(sql)),"Legal sibling move changed account/scope rows.");
        System.out.println("PASS CASE: legal scoped sibling move retains original hierarchy and ancestor-enable semantics");
    }
    static List<Map<String,Object>> rowsWhere(JdbcTemplate sql,String ownedPredicate) {
        // Predicates are fixed probe literals or an actual generated numeric key, never request input.
        return sql.queryForList("SELECT * FROM sys_dept WHERE "+ownedPredicate+" ORDER BY dept_id");
    }
    public static void main(String[] args) throws Exception {
        var sql=new JdbcTemplate(direct());initialize(Path.of(args[0]),sql);
        try(var context=new AnnotationConfigApplicationContext(Config.class)) {
            rollbackCases(context,sql);concurrentCases(context,sql);otherWriters(context,sql);scopes(context,sql);authorizationCases(context,sql);
            System.out.println("PASS: actual MySQL department transaction/rollback/root-lock/data-scope assertions="+assertions.get());
        } finally {clear();sql.execute("DROP TRIGGER IF EXISTS owned_department_failure");}
    }
}
