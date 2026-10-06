import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.tools.ToolProvider;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.rendering.*;

// Emits actual generator output into the caller-owned disposable integration classpath.
class GeneratorBusinessDeploymentCompiler {
    public static void main(String[] args) throws Exception {
        Path output=Path.of(args[0]).toAbsolutePath().normalize();
        Path approved=Path.of(args[1]).toAbsolutePath().normalize();
        if (!output.startsWith(approved) || !output.getFileName().toString().startsWith("generated-business-"))
            throw new IllegalArgumentException("Unexpected owned deployment output.");
        Files.createDirectories(output);
        var sourceFiles=new ArrayList<String>();var ddl=new StringBuilder();
        for (String category:List.of("crud","tree","sub")) {
            var fixtureType=Class.forName("io.eforge.enterprise.web.controller.api.v1.tool.GeneratorEforgeApiTemplateTest");
            var constructor=fixtureType.getDeclaredConstructor();constructor.setAccessible(true);var fixture=constructor.newInstance();
            var factory=fixtureType.getDeclaredMethod("fixture",String.class);factory.setAccessible(true);
            var table=(GenTable)factory.invoke(fixture,category);
            String suffix=category.substring(0,1).toUpperCase()+category.substring(1);
            table.setClassName("Fixture"+suffix);table.setPackageName("io.eforge.enterprise.generated.fixture."+category);
            var options=com.alibaba.fastjson2.JSON.parseObject(table.getOptions());options.put("genView",true);table.setOptions(options.toJSONString());
            table.setFunctionName("Installed "+category);table.setModuleName("fixture");table.setBusinessName(category);table.setTableName("boot_fixture_"+category);
            if(table.isSub()) {table.getSubTable().setClassName("FixtureLine");table.getSubTable().setPackageName(table.getPackageName());
                table.getSubTable().setTableName("boot_fixture_lines");table.setSubTableName("boot_fixture_lines");}
            for(var column:table.getColumns())column.setColumnComment(column.getJavaField());
            if(table.isSub())for(var column:table.getSubTable().getColumns())column.setColumnComment(column.getJavaField());
            var bundle=GeneratorRenderedBundle.render(GeneratorRenderingSnapshot.capture(table));
            for(var file:bundle.files()) {
                if(file.path().endsWith(".java")) {
                    var path=output.resolve(file.path()).normalize();if(!path.startsWith(output))throw new IllegalArgumentException("Unexpected generated source path.");
                    Files.createDirectories(path.getParent());Files.writeString(path,file.content(),StandardCharsets.UTF_8);sourceFiles.add(path.toString());
                } else if(file.template().equals("vm/json/eforge-route.json.vm")) {
                    var path=output.resolve(file.path().substring("main/resources/".length())).normalize();
                    if(!path.startsWith(output))throw new IllegalArgumentException("Unexpected generated manifest path.");
                    Files.createDirectories(path.getParent());Files.writeString(path,file.content(),StandardCharsets.UTF_8);
                } else if(file.template().equals("vm/sql/eforge-menu.sql.vm")) {
                    Files.writeString(output.resolve("menu-"+category+".sql"),file.content(),StandardCharsets.UTF_8);
                } else if(file.template().startsWith("vm/react/")) {
                    var path=output.resolve(file.path()).normalize();
                    if(!path.startsWith(output))throw new IllegalArgumentException("Unexpected generated React path.");
                    Files.createDirectories(path.getParent());Files.writeString(path,file.content(),StandardCharsets.UTF_8);                } else if(file.template().equals("vm/xml/mapper.xml.vm")) {
                    var path=output.resolve("mapper/fixture/Fixture"+suffix+"Mapper.xml");Files.createDirectories(path.getParent());
                    Files.writeString(path,file.content(),StandardCharsets.UTF_8);
                }
            }
            ddl.append("CREATE TABLE boot_fixture_").append(category).append(" (root_id BIGINT PRIMARY KEY,label VARCHAR(255),parent_id BIGINT,amount DECIMAL(30,5),create_time DATETIME(3));\n");
            if(table.isSub())ddl.append("CREATE TABLE boot_fixture_lines(label VARCHAR(255) PRIMARY KEY,parent_id BIGINT NOT NULL);\n");
        }
        var options=new ArrayList<String>(List.of("-parameters","-encoding","UTF-8","-classpath",System.getProperty("java.class.path"),"-d",output.toString()));options.addAll(sourceFiles);
        var errors=new java.io.ByteArrayOutputStream();
        if(ToolProvider.getSystemJavaCompiler().run(null,errors,errors,options.toArray(String[]::new))!=0)
            throw new IllegalStateException("Actual generated deployment did not compile: "+errors.toString(StandardCharsets.UTF_8));
        Files.writeString(output.resolve("physical-fixtures.sql"),ddl,StandardCharsets.UTF_8);
        System.out.println("PASS: actual generated CRUD/tree/sub Java and mapper XML compiled for the original Boot assembly.");
    }
}
