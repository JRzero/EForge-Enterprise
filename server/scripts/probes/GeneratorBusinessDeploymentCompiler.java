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
            {
                var controlFactory=fixtureType.getDeclaredMethod("field",String.class,String.class,String.class,String.class);controlFactory.setAccessible(true);
                var controls=new ArrayList<io.eforge.enterprise.generator.domain.GenTableColumn>(table.getColumns());
                var controlSpecs=List.of(
                    new String[]{"notes","String","textarea",""},
                    new String[]{"selectedStatus","String","select","sys_common_status"},
                    new String[]{"radioStatus","String","radio","sys_common_status"},
                    new String[]{"checkedStatuses","String","checkbox","sys_common_status"},
                    new String[]{"requiredStatuses","String","checkbox","sys_common_status"},
                    new String[]{"insertOnly","String","input",""},
                    new String[]{"editOnly","String","input",""},
                    new String[]{"eventTime","Date","datetime",""},
                    new String[]{"imagePaths","String","imageUpload",""},
                    new String[]{"filePaths","String","fileUpload",""},
                    new String[]{"richContent","String","editor",""},
                    new String[]{"quantity","Integer","input",""},
                    new String[]{"ratio","Double","input",""},
                    new String[]{"enabled","Boolean","input",""},
                    new String[]{"boolSelected","Boolean","select","sys_common_status"},
                    new String[]{"boolRadio","Boolean","radio","sys_common_status"},
                    new String[]{"__proto__","String","input",""});
                for(var spec:controlSpecs) {
                    var column=(io.eforge.enterprise.generator.domain.GenTableColumn)controlFactory.invoke(fixture,spec[0],spec[0],spec[1],null);
                    column.setColumnComment(spec[0]);column.setHtmlType(spec[2]);column.setDictType(spec[3]);
                    if(List.of("requiredStatuses","insertOnly","editOnly","quantity","ratio","enabled").contains(spec[0]))column.setIsRequired("1");
                    if(spec[0].equals("insertOnly"))column.setIsEdit("0");
                    if(spec[0].equals("editOnly"))column.setIsInsert("0");
                    if(spec[2].equals("select")||spec[2].equals("radio"))column.setIsQuery("1");controls.add(column);
                }
                table.setColumns(controls);
                if(table.isSub()) {
                    var childControls=new ArrayList<io.eforge.enterprise.generator.domain.GenTableColumn>(table.getSubTable().getColumns());
                    var childSpecs=new ArrayList<String[]>(controlSpecs);childSpecs.add(new String[]{"long","Long","input",""});childSpecs.add(new String[]{"amount","BigDecimal","input",""});
                    for(var spec:childSpecs) {
                        String childName="child"+(spec[0].equals("__proto__")?"Prototype":Character.toUpperCase(spec[0].charAt(0))+spec[0].substring(1));
                        String fieldName=spec[0].equals("__proto__")?"__proto__":childName;
                        var column=(io.eforge.enterprise.generator.domain.GenTableColumn)controlFactory.invoke(fixture,childName,fieldName,spec[1],null);
                        column.setColumnComment(childName);column.setHtmlType(spec[2]);column.setDictType(spec[3]);childControls.add(column);
                    }
                    table.getSubTable().setColumns(childControls);
                }
            }
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
            ddl.append("ALTER TABLE boot_fixture_").append(category).append(" ADD notes TEXT, ADD selectedStatus VARCHAR(16), ADD radioStatus VARCHAR(16), ADD checkedStatuses VARCHAR(32), ADD requiredStatuses VARCHAR(32), ADD insertOnly VARCHAR(64), ADD editOnly VARCHAR(64), ADD eventTime DATETIME(3), ADD imagePaths TEXT, ADD filePaths TEXT, ADD richContent TEXT, ADD quantity INT, ADD ratio DOUBLE, ADD enabled BOOLEAN, ADD boolSelected BOOLEAN, ADD boolRadio BOOLEAN, ADD __proto__ VARCHAR(255);\n");
            if(table.isSub())ddl.append("CREATE TABLE boot_fixture_lines(label VARCHAR(255) PRIMARY KEY,parent_id BIGINT NOT NULL,childNotes TEXT,childSelectedStatus VARCHAR(16),childRadioStatus VARCHAR(16),childCheckedStatuses VARCHAR(32),childRequiredStatuses VARCHAR(32),childInsertOnly VARCHAR(64),childEditOnly VARCHAR(64),childEventTime DATETIME(3),childImagePaths TEXT,childFilePaths TEXT,childRichContent TEXT,childQuantity INT,childRatio DOUBLE,childEnabled BOOLEAN,childBoolSelected BOOLEAN,childBoolRadio BOOLEAN,childPrototype VARCHAR(255),childLong BIGINT,childAmount DECIMAL(30,5));\n");
        }
        var options=new ArrayList<String>(List.of("-parameters","-encoding","UTF-8","-classpath",System.getProperty("java.class.path"),"-d",output.toString()));options.addAll(sourceFiles);
        var errors=new java.io.ByteArrayOutputStream();
        if(ToolProvider.getSystemJavaCompiler().run(null,errors,errors,options.toArray(String[]::new))!=0)
            throw new IllegalStateException("Actual generated deployment did not compile: "+errors.toString(StandardCharsets.UTF_8));
        Files.writeString(output.resolve("physical-fixtures.sql"),ddl,StandardCharsets.UTF_8);
        System.out.println("PASS: actual generated CRUD/tree/sub Java and mapper XML compiled for the original Boot assembly.");
    }
}
