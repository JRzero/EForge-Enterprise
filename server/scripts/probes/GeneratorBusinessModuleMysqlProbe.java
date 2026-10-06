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
    @org.springframework.context.annotation.Configuration
    @org.springframework.web.servlet.config.annotation.EnableWebMvc
    @org.springframework.boot.context.properties.EnableConfigurationProperties(org.springdoc.core.properties.SpringDocConfigProperties.class)
    @org.springframework.context.annotation.Import({org.springdoc.core.configuration.SpringDocConfiguration.class,
            org.springdoc.webmvc.core.configuration.SpringDocWebMvcConfiguration.class})
    static class NetworkMvc {}
    static int checks;
    static void verifyNetwork(org.springframework.context.ApplicationContext parent, ClassLoader loader,
                              JdbcTemplate jdbc, String category, ObjectMapper json) throws Exception {
        var grants = new java.util.concurrent.atomic.AtomicReference<Set<String>>(Set.of());
        var web = new org.springframework.web.context.support.GenericWebApplicationContext();
        web.setParent(parent); web.setClassLoader(loader); new org.springframework.context.annotation.AnnotatedBeanDefinitionReader(web).register(NetworkMvc.class);
        web.registerBean("networkApiController", (Class) loader.loadClass("generated.api.ApiRootApiController"),
                () -> parent.getBean("apiRootApiController"));
        var factory = new org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory(0);
        factory.setAddress(java.net.InetAddress.getLoopbackAddress());
        var server = factory.getWebServer(servletContext -> {
            var filter = servletContext.addFilter("probeAuthentication", new jakarta.servlet.Filter() {
                public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response,
                                     jakarta.servlet.FilterChain chain) throws java.io.IOException, jakarta.servlet.ServletException {
                    if (((jakarta.servlet.http.HttpServletRequest)request).getRequestURI().equals("/v3/api-docs")
                            && !grants.get().contains("test:entry:query")) {
                        ((jakarta.servlet.http.HttpServletResponse)response).sendError(403); return;
                    }
                    login(grants.get());
                    try { chain.doFilter(request, response); } finally { SecurityContextHolder.clearContext(); }
                }
            });
            filter.addMappingForUrlPatterns(EnumSet.of(jakarta.servlet.DispatcherType.REQUEST), false, "/*");
            var dispatcher = servletContext.addServlet("probeDispatcher", new org.springframework.web.servlet.DispatcherServlet(web));
            dispatcher.setLoadOnStartup(1); dispatcher.addMapping("/");
        });
        try {
            server.start();
            var client = java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(10)).build();
            String route = "http://127.0.0.1:" + server.getPort() + "/api/v1/business/test/entry";
            String id = "9007199254740995";
            var input = new LinkedHashMap<String, Object>();
            input.put("oRderKey", id); input.put("label", "网络中文"); input.put("amount", "9007199254740993.00001"); input.put("parentId", "0");
            if (category.equals("sub")) input.put("apiLineList", List.of(Map.of("label", "网络子表", "ownerReference", "1")));
            String body = json.writeValueAsString(input);
            var post = java.net.http.HttpRequest.newBuilder(java.net.URI.create(route)).timeout(java.time.Duration.ofSeconds(15))
                    .header("Content-Type", "application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build();
            check(client.send(post, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode() == 403, "Network no-role create was not refused.");
            check(jdbc.queryForObject("SELECT COUNT(*) FROM module_" + category, Integer.class) == 0, "Network denied request wrote SQL.");
            grants.set(Set.of("test:entry:add", "test:entry:query", "test:entry:remove"));
            var created = client.send(post, java.net.http.HttpResponse.BodyHandlers.ofString());
            check(created.statusCode() == 201, "Actual network create failed: " + created.body());
            check(json.readTree(created.body()).get("oRderKey").textValue().equals(id), "Network JSON lost exact identifier.");
            check(jdbc.queryForObject("SELECT label FROM module_" + category, String.class).equals("网络中文"), "Actual network create did not persist.");
            var docsRequest = java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + server.getPort() + "/v3/api-docs")).GET().build();
            var docsResponse = client.send(docsRequest, java.net.http.HttpResponse.BodyHandlers.ofString());
            check(docsResponse.statusCode() == 200, "Actual generated OpenAPI HTTP failed: " + docsResponse.body());
            var spec = json.readTree(docsResponse.body());
            ((com.fasterxml.jackson.databind.node.ObjectNode)spec).remove("servers");
            Path contractOutput = Path.of(System.getProperty("eforge.probe.repo")).resolve("server/eforge-boot/target/generated-business-openapi");
            Files.createDirectories(contractOutput);
            Files.writeString(contractOutput.resolve(category + ".json"), json.writerWithDefaultPrettyPrinter().writeValueAsString(spec), StandardCharsets.UTF_8);
            check(spec.path("paths").has("/api/v1/business/test/entry"), "Generated business API missing from actual OpenAPI.");
            check(spec.path("paths").path("/api/v1/business/test/entry").path("post").path("operationId").asText().equals("test_entry_create"), "Generated OpenAPI create operation identity changed.");
            check(spec.path("components").path("schemas").path("test_ApiRootApiModel").path("properties").path("oRderKey").path("type").asText().equals("string"), "Actual generated OpenAPI exact ID schema was not string.");
            var paths = spec.path("paths").path("/api/v1/business/test/entry");
            check(paths.path("post").path("responses").has("201"), "Create success is not documented as201.");
            check(paths.path("delete").path("responses").has("204"), "Delete success is not documented as204.");
            check(spec.path("paths").path("/api/v1/business/test/entry/{id}").path("get").path("parameters").get(0).path("schema").path("type").asText().equals("string"), "Path long ID schema would lose precision in generated client.");
            check(spec.path("components").path("schemas").path("test_ApiRootDeleteRequest").path("properties").path("ids").path("items").path("type").asText().equals("string"), "Delete ID schema would lose precision in generated client.");
            var params = paths.path("get").path("parameters");
            boolean decimalQueryString = false;
            for (var param : params) if (param.path("name").asText().equals("q_begin_amount")) decimalQueryString = param.path("schema").path("type").asText().equals("string");
            check(decimalQueryString, "Generated decimal query schema would lose precision in client.");
            grants.set(Set.of("test:entry:add", "test:entry:query", "test:entry:remove", "test:entry:edit", "test:entry:list", "test:entry:export"));
            var clientLogPath = contractOutput.resolve(category + ".client.log");
            var clientProcess = new ProcessBuilder("node", Path.of(System.getProperty("eforge.probe.repo")).resolve("web/scripts/verify-generator-business-client.mjs").toString(),
                    contractOutput.resolve(category + ".json").toString(), "http://127.0.0.1:" + server.getPort(), category).redirectErrorStream(true).redirectOutput(clientLogPath.toFile()).start();
            boolean finished = clientProcess.waitFor(90, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) { clientProcess.destroyForcibly(); clientProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS); }
            String clientLog = Files.readString(clientLogPath, StandardCharsets.UTF_8);
            check(finished && clientProcess.exitValue() == 0, "Generated actual HTTP client failed or timed out: " + clientLog);
            System.out.print(clientLog);
            check(jdbc.queryForObject("SELECT COUNT(*) FROM module_" + category, Integer.class) == 1, "Generated client left extra SQL data after delete.");
            var detail = java.net.http.HttpRequest.newBuilder(java.net.URI.create(route + "/" + id)).GET().build();
            check(client.send(detail, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode() == 200, "Network detail failed.");
            grants.set(Set.of("test:entry:remove"));
            check(client.send(detail, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode() == 403, "Network revoked permission remained usable.");
            check(client.send(docsRequest, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode() == 403, "Test deployed OpenAPI remained available after permission withdrawal.");
            var delete = java.net.http.HttpRequest.newBuilder(java.net.URI.create(route)).header("Content-Type", "application/json")
                    .method("DELETE", java.net.http.HttpRequest.BodyPublishers.ofString("{\"ids\":[\"" + id + "\"]}")).build();
            check(client.send(delete, java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode() == 204, "Network delete failed.");
            check(jdbc.queryForObject("SELECT COUNT(*) FROM module_" + category, Integer.class) == 0, "Network delete did not persist.");
            if (category.equals("sub")) check(jdbc.queryForObject("SELECT COUNT(*) FROM module_lines", Integer.class) == 0, "Network subtable delete did not persist.");
        } finally { try { server.stop(); } finally { try { server.destroy(); } finally { web.close(); } } }
    }
    static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    static void login(Set<String> grants) {
        var user=new SysUser();user.setUserId(42L);user.setUserName("real_generated_actor");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new LoginUser(user,grants),null,List.of()));
    }
    static Object invoke(Object fixture,String method,Class<?>[] types,Object...values)throws Exception {
        var action=fixture.getClass().getDeclaredMethod(method,types);action.setAccessible(true);return action.invoke(fixture,values);
    }
    public static void main(String[] args)throws Exception {
        System.setProperty("eforge.probe.repo", Path.of(args[0]).toAbsolutePath().normalize().toString());
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
                    verifyNetwork(context, loader, jdbc, category, json);
                }
            }
            System.out.println("PASS: "+checks+" actual generated CRUD/tree/sub MySQL, Spring MVC and actual loopback HTTP assertions; original mapper/service, exact IDs/decimal/data, permissions and real child rollback.");
        } finally {
            SecurityContextHolder.clearContext();
            Path tempRoot=Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            if(!owned.startsWith(tempRoot)||!owned.getFileName().toString().startsWith("eforge-generated-module-"))throw new IllegalStateException("Unsafe owned temporary cleanup target.");
            try(var paths=Files.walk(owned)){for(var path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}
        }
    }
}
