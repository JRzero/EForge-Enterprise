package io.eforge.enterprise.web.controller.api.v1.tool;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.net.URLClassLoader;
import java.util.*;
import java.math.BigDecimal;
import javax.tools.ToolProvider;
import java.lang.reflect.Proxy;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.rendering.*;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorEforgeApiTemplateTest {
    @org.springframework.context.annotation.Configuration
    @org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
    static class SecurityConfiguration {}
    @TempDir Path directory;
    GenTableColumn field(String physical,String name,String type,String query) {
        var field=new GenTableColumn();field.setColumnName(physical);field.setJavaField(name);field.setJavaType(type);
        field.setColumnComment("中文 */ \\u000a 字段");field.setIsPk("0");field.setIsList("1");field.setIsQuery(query==null?"0":"1");
        field.setIsInsert("1");field.setIsEdit("1");field.setQueryType(query==null?"EQ":query);return field;
    }
    GenTable fixture(String category) {
        var legacy=new GeneratorDomainTextTest();var root=legacy.table(category,"ApiRoot");root.setTplWebType("eforge-react");
        var key=field("root_id","oRderKey","Long",null);key.setIsPk("1");
        var label=field("label","label","String","LIKE");var parent=field("parent_id","parentId","Long",null);
        var amount=field("amount","amount","BigDecimal","BETWEEN");var time=field("create_time","createTime","Date","BETWEEN");
        root.setColumns(List.of(key,label,parent,amount,time));root.setPkColumn(key);
        root.setOptions("{\"parentMenuId\":\"3\",\"treeCode\":\"root_id\",\"treeParentCode\":\"parent_id\",\"treeName\":\"label\"}");
        if(category.equals("sub")) {
            var child=legacy.table("crud","ApiLine");child.setColumns(List.of(child.getColumns().get(0),field("parent_id","ownerReference","Long",null)));
            root.setSubTable(child);root.setSubTableName(child.getTableName());root.setSubTableFkName("parent_id");
        }
        return root;
    }
    void compile(List<String> sources,String classpath) {
        var args=new ArrayList<String>(List.of("-parameters","-encoding","UTF-8","-classpath",classpath,"-d",directory.toString()));args.addAll(sources);
        var diagnostics=new java.io.ByteArrayOutputStream();
        assertEquals(0,ToolProvider.getSystemJavaCompiler().run(null,diagnostics,diagnostics,args.toArray(String[]::new)),diagnostics.toString(StandardCharsets.UTF_8));
    }
    @ParameterizedTest @ValueSource(strings={"crud","tree","sub"})
    void actualGeneratedSourcesCompileAndServeCanonicalReadModels(String category)throws Exception {
        var table=fixture(category);var bundle=GeneratorRenderedBundle.render(GeneratorRenderingSnapshot.capture(table));
        var sourceFiles=new ArrayList<String>();
        for(var file:bundle.files()) if(file.path().endsWith(".java")) {
            var target=directory.resolve(file.path());Files.createDirectories(target.getParent());Files.writeString(target,file.content(),StandardCharsets.UTF_8);sourceFiles.add(target.toString());
        }
        String fullClasspath=System.getProperty("java.class.path");
        var entries=Arrays.asList(fullClasspath.split(java.util.regex.Pattern.quote(java.io.File.pathSeparator)));
        var backendEntries=entries.stream().filter(entry->{String normalized=entry.replace((char)92,'/');return !normalized.endsWith("/eforge-boot/target/classes")&&!normalized.endsWith("/eforge-boot/target/test-classes");}).toList();
        assertTrue(backendEntries.size()<entries.size(),"The product compile must exclude actual boot output.");
        String backendClasspath=String.join(java.io.File.pathSeparator,backendEntries);
        var backendSources=sourceFiles.stream().filter(file->!file.replace((char)92,'/').contains("/generated/api/")).toList();
        var apiSources=sourceFiles.stream().filter(file->file.replace((char)92,'/').contains("/generated/api/")).toList();
        assertEquals(2,apiSources.size());
        compile(backendSources,backendClasspath);
        compile(apiSources,fullClasspath+java.io.File.pathSeparator+directory);
        try(var classes=new URLClassLoader(new java.net.URL[]{directory.toUri().toURL()},getClass().getClassLoader())) {
            var domainType=classes.loadClass("generated.domain.ApiRoot");var row=domainType.getConstructor().newInstance();
            domainType.getMethod("setoRderKey",Long.class).invoke(row,9007199254740993L);
            domainType.getMethod("setLabel",String.class).invoke(row,GeneratorDomainTextTest.ATTACK);
            domainType.getMethod("setAmount",BigDecimal.class).invoke(row,new BigDecimal("9007199254740993.00001"));
            domainType.getMethod("setCreateTime",Date.class).invoke(row,new Date(1700000000123L));
            if(category.equals("sub")) {
                var childType=classes.loadClass("generated.domain.ApiLine");var child=childType.getConstructor().newInstance();
                childType.getMethod("setOwnerReference",Long.class).invoke(child,9007199254740993L);
                domainType.getMethod("setApiLineList",List.class).invoke(row,List.of(child));
            }
            var modelType=classes.loadClass("generated.api.ApiRootApiModel");assertEquals(Record.class,modelType.getSuperclass());
            var model=modelType.getMethod("from",domainType).invoke(null,row);var mapper=new ObjectMapper();var json=mapper.readTree(mapper.writeValueAsString(model));
            assertEquals("9007199254740993",json.get("oRderKey").textValue());assertFalse(json.has("ORderKey"));assertFalse(json.has("params"));assertFalse(json.has("searchValue"));
            assertEquals("9007199254740993.00001",json.get("amount").textValue());assertEquals(GeneratorDomainTextTest.ATTACK,json.get("label").textValue());
            assertEquals("2023-11-14T22:13:20.123Z",json.get("createTime").textValue());
            if(category.equals("sub")) assertEquals("9007199254740993",json.get("apiLineList").get(0).get("ownerReference").textValue());
            var serviceType=classes.loadClass("generated.service.IApiRootService");var captured=new ArrayList<Object>();var mutations=new ArrayList<Object>();
            var service=Proxy.newProxyInstance(classes,new Class<?>[]{serviceType},(proxy,method,values)->{
                if(method.getName().equals("selectApiRootList")){if(domainType.getMethod("getLabel") .invoke(values[0])!=null && domainType.getMethod("getLabel").invoke(values[0]).equals("unavailable"))throw new org.springframework.dao.DataAccessResourceFailureException("private JDBC host/password");captured.add(values[0]);return List.of(row);}
                if(method.getName().equals("selectApiRootByORderKey"))return values[0].equals(9007199254740993L)?row:null;
                if(method.getName().equals("insertApiRoot")||method.getName().equals("updateApiRoot")||method.getName().equals("deleteApiRootByORderKeys")){mutations.add(values[0]);return 1;}
                throw new AssertionError(method.getName());
            });
            var controllerType=classes.loadClass("generated.api.ApiRootApiController");var controller=controllerType.getConstructor(serviceType).newInstance(service);
            var mvc=MockMvcBuilders.standaloneSetup(controller).build();
            var response=mvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry").param("page","1").param("pageSize","2")
                .param("q_label",GeneratorDomainTextTest.ATTACK).param("q_begin_amount","1.00001").param("q_end_amount","99.99999")).andReturn().getResponse();
            assertEquals(200,response.getStatus(),response.getContentAsString());assertEquals("no-store",response.getHeader("Cache-Control"));
            var body=mapper.readTree(response.getContentAsString());var item=category.equals("tree")?body.get(0):body.get("items").get(0);
            assertEquals("9007199254740993",item.get("oRderKey").textValue());assertFalse(item.has("params"));
            assertEquals(GeneratorDomainTextTest.ATTACK,domainType.getMethod("getLabel").invoke(captured.get(0)));
            var bounds=(Map<?,?>)domainType.getMethod("getParams").invoke(captured.get(0));assertEquals(new BigDecimal("1.00001"),bounds.get("beginAmount"));assertEquals(new BigDecimal("99.99999"),bounds.get("endAmount"));
            assertNull(com.github.pagehelper.PageHelper.getLocalPage());
            var detail=mvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry/9007199254740993")).andReturn().getResponse();assertEquals(200,detail.getStatus());
            assertEquals("9007199254740993",mapper.readTree(detail.getContentAsString()).get("oRderKey").textValue());
            var invalid=mvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry").param("pageSize","101")).andReturn().getResponse();assertEquals(400,invalid.getStatus());assertEquals(1,captured.size());
            assertEquals("VALIDATION_ERROR",mapper.readTree(invalid.getContentAsString()).get("code").textValue());
            var missing=mvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry/2")).andReturn().getResponse();assertEquals(404,missing.getStatus());
            assertEquals("RESOURCE_NOT_FOUND",mapper.readTree(missing.getContentAsString()).get("code").textValue());
            var failed=mvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry").param("q_label","unavailable")).andReturn().getResponse();
            assertEquals(503,failed.getStatus());assertTrue(failed.getContentType().startsWith("application/problem+json"));
            assertEquals("RESOURCE_UNAVAILABLE",mapper.readTree(failed.getContentAsString()).get("code").textValue());assertFalse(failed.getContentAsString().contains("private"));
            assertNull(com.github.pagehelper.PageHelper.getLocalPage());
            try(var security=new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
                security.setClassLoader(classes);
                security.register(SecurityConfiguration.class);
                security.getBeanFactory().registerSingleton("ss",new io.eforge.enterprise.framework.web.service.PermissionService());
                security.registerBean("generatedController",(Class)controllerType,()->controller);
                security.refresh();
                var securedMvc=MockMvcBuilders.standaloneSetup(security.getBean("generatedController")).build();
                var user=new io.eforge.enterprise.common.core.domain.entity.SysUser();user.setUserId(42L);user.setUserName("generated-reader");
                var login=new io.eforge.enterprise.common.core.domain.model.LoginUser(user,Set.of());
                var securityContext=org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
                securityContext.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(login,null,List.of()));
                org.springframework.security.core.context.SecurityContextHolder.setContext(securityContext);
                try {
                    int calls=captured.size();
                    var denied=securedMvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry")).andReturn().getResponse();
                    assertEquals(403,denied.getStatus(),denied.getContentAsString());assertEquals(calls,captured.size());
                    assertEquals("ACCESS_DENIED",mapper.readTree(denied.getContentAsString()).get("code").textValue());
                    login.setPermissions(Set.of("test:entry:list"));
                    var allowed=securedMvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry").param("q_label","allowed")).andReturn().getResponse();
                    assertEquals(200,allowed.getStatus(),allowed.getContentAsString());assertEquals(calls+1,captured.size());
                    var deniedDetail=securedMvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry/9007199254740993")).andReturn().getResponse();assertEquals(403,deniedDetail.getStatus());
                    login.setPermissions(Set.of("test:entry:query"));
                    var allowedDetail=securedMvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry/9007199254740993")).andReturn().getResponse();assertEquals(200,allowedDetail.getStatus());
                    var payload=new LinkedHashMap<String,Object>();payload.put("oRderKey","9007199254740993");payload.put("label",GeneratorDomainTextTest.ATTACK);
                    payload.put("amount","9007199254740993.00001");payload.put("createBy","spoofed");payload.put("params",Map.of("injected","private"));
                    if(category.equals("sub"))payload.put("apiLineList",List.of(Map.of("label","child","ownerReference","1")));
                    String input=mapper.writeValueAsString(payload);
                    var deniedWrite=securedMvc.perform(MockMvcRequestBuilders.post("/api/v1/business/test/entry").contentType("application/json").content(input)).andReturn().getResponse();
                    assertEquals(403,deniedWrite.getStatus());assertTrue(mutations.isEmpty());
                    login.setPermissions(Set.of("test:entry:add"));
                    var created=securedMvc.perform(MockMvcRequestBuilders.post("/api/v1/business/test/entry").contentType("application/json").content(input)).andReturn().getResponse();
                    assertEquals(201,created.getStatus(),created.getContentAsString());assertEquals(1,mutations.size());
                    assertEquals("generated-reader",domainType.getMethod("getCreateBy").invoke(mutations.get(0)));
                    assertEquals(GeneratorDomainTextTest.ATTACK,domainType.getMethod("getLabel").invoke(mutations.get(0)));
                    assertEquals(new BigDecimal("9007199254740993.00001"),domainType.getMethod("getAmount").invoke(mutations.get(0)));
                    assertTrue(((Map<?,?>)domainType.getMethod("getParams").invoke(mutations.get(0))).isEmpty());
                    login.setPermissions(Set.of("test:entry:edit"));
                    var mismatched=securedMvc.perform(MockMvcRequestBuilders.put("/api/v1/business/test/entry/2").contentType("application/json").content(input)).andReturn().getResponse();
                    assertEquals(400,mismatched.getStatus());assertEquals(1,mutations.size());
                    var updated=securedMvc.perform(MockMvcRequestBuilders.put("/api/v1/business/test/entry/9007199254740993").contentType("application/json").content(input)).andReturn().getResponse();
                    assertEquals(200,updated.getStatus(),updated.getContentAsString());assertEquals(2,mutations.size());
                    assertEquals("generated-reader",domainType.getMethod("getUpdateBy").invoke(mutations.get(1)));
                    login.setPermissions(Set.of("test:entry:remove"));
                    var duplicates=securedMvc.perform(MockMvcRequestBuilders.delete("/api/v1/business/test/entry").contentType("application/json").content("{\"ids\":[\"9007199254740993\",\"9007199254740993\"]}")).andReturn().getResponse();
                    assertEquals(400,duplicates.getStatus());assertEquals(2,mutations.size());
                    var deleted=securedMvc.perform(MockMvcRequestBuilders.delete("/api/v1/business/test/entry").contentType("application/json").content("{\"ids\":[\"9007199254740993\"]}")).andReturn().getResponse();
                    assertEquals(204,deleted.getStatus());assertEquals(3,mutations.size());assertEquals(9007199254740993L,((Long[])mutations.get(2))[0]);
                    login.setPermissions(Set.of());
                    assertEquals(403,securedMvc.perform(MockMvcRequestBuilders.get("/api/v1/business/test/entry")).andReturn().getResponse().getStatus());assertEquals(calls+1,captured.size());
                    var exportDenied=securedMvc.perform(MockMvcRequestBuilders.post("/api/v1/business/test/entry/export").param("q_label","export")).andReturn().getResponse();
                    assertEquals(403,exportDenied.getStatus());assertEquals(calls+1,captured.size());
                    login.setPermissions(Set.of("test:entry:export"));
                    var exported=securedMvc.perform(MockMvcRequestBuilders.post("/api/v1/business/test/entry/export").param("q_label","export").param("page","2").param("pageSize","1")).andReturn().getResponse();
                    assertEquals(200,exported.getStatus(),exported.getContentAsString());assertEquals("no-store",exported.getHeader("Cache-Control"));assertEquals(calls+2,captured.size());
                    assertEquals("export",domainType.getMethod("getLabel").invoke(captured.get(captured.size()-1)));assertNull(com.github.pagehelper.PageHelper.getLocalPage());
                    try(var workbook=org.apache.poi.ss.usermodel.WorkbookFactory.create(new java.io.ByteArrayInputStream(exported.getContentAsByteArray()))) {
                        assertEquals(1,workbook.getNumberOfSheets());assertTrue(workbook.getSheetAt(0).getLastRowNum()>0);
                    }
                } finally {org.springframework.security.core.context.SecurityContextHolder.clearContext();}
            }
        }
    }
}
