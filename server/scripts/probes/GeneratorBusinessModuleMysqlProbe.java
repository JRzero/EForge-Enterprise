import java.util.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.net.URLClassLoader;
import java.lang.reflect.*;
import javax.sql.DataSource;
import org.springframework.context.annotation.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.mybatis.spring.*;
import org.mybatis.spring.mapper.MapperFactoryBean;
import org.apache.ibatis.session.Configuration;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.rendering.*;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;

class GeneratorBusinessModuleMysqlProbe {
    @org.springframework.context.annotation.Configuration
    @EnableMethodSecurity @EnableTransactionManagement
    static class SecurityAndTransactions {}
    static int checks;
    static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    static void login(Set<String> grants) {
        var user=new SysUser();user.setUserId(42L);user.setUserName("real_generated_actor");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new LoginUser(user,grants),null,List.of()));
    }
    static Object invoke(Object fixture,String method,Class<?>[] types,Object...values)throws Exception {
        var action=fixture.getClass().getDeclaredMethod(method,types);action.setAccessible(true);return action.invoke(fixture,values);
    }
    public static void main(String[] args)throws Exception {
        var ds=new DriverManagerDataSource(System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD"));
        var jdbc=new JdbcTemplate(ds);var json=new ObjectMapper();
        Path owned=Files.createTempDirectory("eforge-generated-module-").toAbsolutePath().normalize();
        try {
            for(String category:List.of("crud","tree","sub")) {
                Path output=owned.resolve(category);Files.createDirectories(output);
                var fixtureType=Class.forName("io.eforge.enterprise.web.controller.api.v1.tool.GeneratorEforgeApiTemplateTest");
                var constructor=fixtureType.getDeclaredConstructor();constructor.setAccessible(true);var fixture=constructor.newInstance();
                var temp=fixtureType.getDeclaredField("directory");temp.setAccessible(true);temp.set(fixture,output);
                var table=(GenTable)invoke(fixture,"fixture",new Class<?>[]{String.class},category);
                table.setTableName("module_"+category);if(table.isSub()) {table.getSubTable().setTableName("module_lines");table.setSubTableName("module_lines");}
                jdbc.execute("CREATE TABLE module_"+category+" (root_id BIGINT PRIMARY KEY,label VARCHAR(255),parent_id BIGINT,amount DECIMAL(30,5),create_time DATETIME(3))");
                if(table.isSub())jdbc.execute("CREATE TABLE module_lines(label VARCHAR(255) PRIMARY KEY,parent_id BIGINT NOT NULL)");
                var bundle=GeneratorRenderedBundle.render(GeneratorRenderingSnapshot.capture(table));var sources=new ArrayList<String>();
                for(var file:bundle.files())if(file.path().endsWith(".java")){var path=output.resolve(file.path());Files.createDirectories(path.getParent());Files.writeString(path,file.content(),StandardCharsets.UTF_8);sources.add(path.toString());}
                invoke(fixture,"compile",new Class<?>[]{List.class,String.class},sources,System.getProperty("java.class.path"));
                try(var loader=new URLClassLoader(new java.net.URL[]{output.toUri().toURL()},GeneratorBusinessModuleMysqlProbe.class.getClassLoader());
                    var context=new AnnotationConfigApplicationContext()) {
                    context.setClassLoader(loader);context.register(SecurityAndTransactions.class);
                    context.getBeanFactory().registerSingleton("dataSource",ds);
                    context.getBeanFactory().registerSingleton("transactionManager",new DataSourceTransactionManager(ds));
                    context.getBeanFactory().registerSingleton("ss",new io.eforge.enterprise.framework.web.service.PermissionService());
                    var configuration=new Configuration();configuration.getTypeAliasRegistry().registerAlias(loader.loadClass("generated.domain.ApiRoot"));
                    if(table.isSub())configuration.getTypeAliasRegistry().registerAlias(loader.loadClass("generated.domain.ApiLine"));
                    var paging=new com.github.pagehelper.PageInterceptor();var properties=new Properties();properties.setProperty("helperDialect","mysql");paging.setProperties(properties);
                    var factory=new SqlSessionFactoryBean();factory.setDataSource(ds);factory.setConfiguration(configuration);factory.setPlugins(paging);
                    var mapperFile=bundle.files().stream().filter(file->file.template().equals("vm/xml/mapper.xml.vm")).findFirst().orElseThrow();
                    factory.setMapperLocations(new org.springframework.core.io.ByteArrayResource(mapperFile.content().getBytes(StandardCharsets.UTF_8)));
                    var sessions=factory.getObject();
                    var mapperType=loader.loadClass("generated.mapper.ApiRootMapper");
                    context.registerBean("apiRootMapper",MapperFactoryBean.class,()->{var mapper=new MapperFactoryBean(mapperType);mapper.setSqlSessionFactory(sessions);return mapper;});
                    context.registerBean("apiRootService",(Class)loader.loadClass("generated.service.impl.ApiRootServiceImpl"));
                    context.registerBean("apiRootApiController",(Class)loader.loadClass("generated.api.ApiRootApiController"));context.refresh();
                    var mvc=MockMvcBuilders.standaloneSetup(context.getBean("apiRootApiController")).build();
                    String route="/api/v1/business/test/entry";long id=9007199254740993L;
                    var input=new LinkedHashMap<String,Object>();input.put("oRderKey",Long.toString(id));input.put("label","中文 \\\" ; DROP TABLE untouched --");input.put("amount","9007199254740993.00001");input.put("parentId","0");
                    if(table.isSub())input.put("apiLineList",List.of(Map.of("label","原子表","ownerReference","1")));
                    login(Set.of());var denied=mvc.perform(MockMvcRequestBuilders.post(route).contentType("application/json").content(json.writeValueAsString(input))).andReturn().getResponse();
                    check(denied.getStatus()==403,"No-role create was not refused.");check(jdbc.queryForObject("SELECT COUNT(*) FROM module_"+category,Integer.class)==0,"Denied create wrote physical data.");
                    login(Set.of("test:entry:add","test:entry:edit","test:entry:list","test:entry:query","test:entry:remove"));
                    var created=mvc.perform(MockMvcRequestBuilders.post(route).contentType("application/json").content(json.writeValueAsString(input))).andReturn().getResponse();
                    check(created.getStatus()==201,"Real generated create failed: "+created.getContentAsString());var saved=json.readTree(created.getContentAsString());
                    check(saved.get("oRderKey").textValue().equals(Long.toString(id)),"Long ID lost in SQL/create response.");
                    check(saved.get("amount").textValue().equals("9007199254740993.00001"),"Actual SQL decimal lost precision.");
                    check(jdbc.queryForObject("SELECT label FROM module_"+category,String.class).equals(input.get("label")),"SQL string data was changed.");
                    if(table.isSub())check(jdbc.queryForObject("SELECT parent_id FROM module_lines",Long.class)==id,"Original generated service did not assign actual parent key.");
                    var list=mvc.perform(MockMvcRequestBuilders.get(route).param("q_label","中文").param("page","1").param("pageSize","1")).andReturn().getResponse();
                    check(list.getStatus()==200,"Real generated list failed.");var listed=json.readTree(list.getContentAsString());
                    check(category.equals("tree")?listed.size()==1:listed.get("total").longValue()==1,"Actual SQL filtered pagination/tree list failed.");
                    check(com.github.pagehelper.PageHelper.getLocalPage()==null,"Actual query retained PageHelper state.");
                    input.put("label","更新中文");if(table.isSub())input.put("apiLineList",List.of(Map.of("label","新子表","ownerReference","2")));
                    var updated=mvc.perform(MockMvcRequestBuilders.put(route+"/"+id).contentType("application/json").content(json.writeValueAsString(input))).andReturn().getResponse();check(updated.getStatus()==200,"Real generated update failed: "+updated.getContentAsString());
                    check(jdbc.queryForObject("SELECT label FROM module_"+category,String.class).equals("更新中文"),"Actual root update did not persist.");
                    if(table.isSub())check(jdbc.queryForObject("SELECT label FROM module_lines",String.class).equals("新子表"),"Actual child replacement did not persist.");
                    // Strict parent update fails after the service deletes/inserts children: all must roll back.
                    input.put("label","x".repeat(400));if(table.isSub())input.put("apiLineList",List.of(Map.of("label","不应提交","ownerReference","3")));
                    var failed=mvc.perform(MockMvcRequestBuilders.put(route+"/"+id).contentType("application/json").content(json.writeValueAsString(input))).andReturn().getResponse();
                    check(failed.getStatus()==503,"Strict actual UPDATE did not fail safely: "+failed.getContentAsString());check(!failed.getContentAsString().contains("Data truncation"),"Actual driver details escaped.");
                    check(jdbc.queryForObject("SELECT label FROM module_"+category,String.class).equals("更新中文"),"Failed actual root write escaped rollback.");
                    if(table.isSub())check(jdbc.queryForObject("SELECT label FROM module_lines",String.class).equals("新子表"),"Child delete/insert escaped outer transaction rollback.");
                    var deleted=mvc.perform(MockMvcRequestBuilders.delete(route).contentType("application/json").content("{\"ids\":[\""+id+"\"]}")).andReturn().getResponse();check(deleted.getStatus()==204,"Actual delete failed.");
                    check(jdbc.queryForObject("SELECT COUNT(*) FROM module_"+category,Integer.class)==0,"Actual root delete did not persist.");
                    if(table.isSub())check(jdbc.queryForObject("SELECT COUNT(*) FROM module_lines",Integer.class)==0,"Actual child delete did not persist.");
                }
            }
            System.out.println("PASS: "+checks+" actual generated CRUD/tree/sub MySQL and Spring MVC assertions; original mapper/service, exact IDs/decimal/data, permissions and real child rollback.");
        } finally {
            SecurityContextHolder.clearContext();
            Path tempRoot=Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            if(!owned.startsWith(tempRoot)||!owned.getFileName().toString().startsWith("eforge-generated-module-"))throw new IllegalStateException("Unsafe owned temporary cleanup target.");
            try(var paths=Files.walk(owned)){for(var path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}
        }
    }
}
