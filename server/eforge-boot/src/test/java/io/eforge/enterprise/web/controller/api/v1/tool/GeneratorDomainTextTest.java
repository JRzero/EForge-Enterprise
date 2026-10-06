package io.eforge.enterprise.web.controller.api.v1.tool;

import java.io.StringWriter;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.net.URLClassLoader;
import java.util.*;
import javax.tools.ToolProvider;
import org.apache.velocity.app.Velocity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.util.*;
import io.eforge.enterprise.common.annotation.Excel;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorDomainTextTest {
 @TempDir Path directory;
 static final String ATTACK="中文\"\\u000a\n*/ public static int injected=1; //";
 GenTable table(String type,String name){
  var table=new GenTable();table.setClassName(name);table.setTableName("quoted`表");table.setFunctionName(ATTACK);table.setFunctionAuthor(ATTACK);
  table.setTplCategory(type);table.setTplWebType("element-plus");table.setPackageName("generated");table.setModuleName("test");table.setBusinessName("entry");table.setFormColNum(1);
  table.setOptions("{\"parentMenuId\":\"3\",\"treeCode\":\"id\",\"treeParentCode\":\"parent_id\",\"treeName\":\"label\"}");
  var field=new GenTableColumn();field.setColumnName("label");field.setJavaField("label");field.setJavaType("String");field.setColumnComment(ATTACK);field.setIsList("1");field.setIsPk("1");field.setSort(1);table.setColumns(List.of(field));table.setPkColumn(field);return table;
 }
 public static class PermissionWitness {
  public String received; public boolean hasPermi(String value){received=value;return true;}
 }
 void compileAndInspect(GenTable table,String label,String converter)throws Exception{compileAndInspect(table,label,converter,null);}
 void compileAndInspect(GenTable table,String label,String converter,String permissionOverride)throws Exception{
  VelocityInitializer.initVelocity();var context=VelocityUtils.prepareContext(table);if(permissionOverride!=null)context.put("permissionPrefix",permissionOverride);var sources=new ArrayList<String>();
  for(String template:VelocityUtils.getTemplateList(table).stream().filter(name->name.endsWith(".java.vm")).toList()){
   var writer=new StringWriter();Velocity.getTemplate(template,"UTF-8").merge(context,writer);
   Path file=directory.resolve(VelocityUtils.getFileName(template,table));Files.createDirectories(file.getParent());
   Files.writeString(file,writer.toString(),StandardCharsets.UTF_8);sources.add(file.toString());
  }
  var arguments=new ArrayList<String>(List.of("-encoding","UTF-8","-classpath",System.getProperty("java.class.path"),"-d",directory.toString()));arguments.addAll(sources);
  var diagnostics=new java.io.ByteArrayOutputStream();
  assertEquals(0,ToolProvider.getSystemJavaCompiler().run(null,diagnostics,diagnostics,arguments.toArray(String[]::new)),diagnostics.toString(StandardCharsets.UTF_8));
  try(var classes=new URLClassLoader(new java.net.URL[]{directory.toUri().toURL()},getClass().getClassLoader())){
   for(String name:table.isSub()?List.of(table.getClassName(),table.getSubTable().getClassName()):List.of(table.getClassName())){
    var type=classes.loadClass("generated.domain."+name);
    assertThrows(NoSuchFieldException.class,()->type.getDeclaredField("injected"));
    var annotation=type.getDeclaredField("label").getAnnotation(Excel.class);assertEquals(label,annotation.name());assertEquals(converter,annotation.readConverterExp());
    var controller=classes.loadClass("generated.controller."+table.getClassName()+"Controller");
    assertEquals("/"+table.getModuleName()+"/"+table.getBusinessName(),controller.getAnnotation(org.springframework.web.bind.annotation.RequestMapping.class).value()[0]);
    var actions=new HashSet<String>();
    for(var method:controller.getDeclaredMethods()) {
     var permission=method.getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class);
     if(permission!=null){
      var witness=new PermissionWitness();var evaluation=new org.springframework.expression.spel.support.StandardEvaluationContext();
      evaluation.setBeanResolver((ignored,bean)->{assertEquals("ss",bean);return witness;});
      assertEquals(Boolean.TRUE,new org.springframework.expression.spel.standard.SpelExpressionParser().parseExpression(permission.value()).getValue(evaluation));
      String prefix=permissionOverride==null?table.getModuleName()+":"+table.getBusinessName():permissionOverride;
      assertTrue(witness.received.startsWith(prefix+":"));actions.add(witness.received.substring(prefix.length()+1));
     }
     var audit=method.getAnnotation(io.eforge.enterprise.common.annotation.Log.class);
     if(audit!=null)assertEquals(ATTACK,audit.title());
    }
    assertEquals(Set.of("list","export","query","add","edit","remove"),actions);
    var instance=type.getConstructor().newInstance();type.getMethod("setLabel",String.class).invoke(instance,ATTACK);assertEquals(ATTACK,type.getMethod("getLabel").invoke(instance));
   }
  }
 }
 @Test void rootTemplateContainsHostileLabelsAsAnnotationData()throws Exception{compileAndInspect(table("crud","RootText"),ATTACK,"");}
 @Test void rootAndChildTemplatePreserveOriginalConverterSemanticsWithEscapedValues()throws Exception{
  var root=table("sub","RootLines");var child=table("crud","ChildLine");String comment=ATTACK+"（0正常\"\\u000a 1停用）";
  root.getColumns().get(0).setColumnComment(comment);child.getColumns().get(0).setColumnComment(comment);
  root.setSubTableName(child.getTableName());root.setSubTableFkName("label");root.setSubTable(child);
  compileAndInspect(root,ATTACK,"0=正常\"\\u000a,1=停用");
 }
 @Test void actualControllerSpelAndRouteAnnotationsPreserveHostileTextAsData()throws Exception{
  String marker="eforge.generator.permission-injection";assertNull(System.getProperty(marker));
  String permission="x');T(java.lang.System).setProperty('"+marker+"','yes');('";
  var root=table("crud","PermissionText");root.setModuleName("模块\"\\文本");root.setBusinessName("业务'文本");
  compileAndInspect(root,ATTACK,"",permission);assertNull(System.getProperty(marker));
 }
 @Test void treeTemplateCompilesWithHostileMetadataWithoutNewMembers()throws Exception{compileAndInspect(table("tree","TreeText"),ATTACK,"");}
}