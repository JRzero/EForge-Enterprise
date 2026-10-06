import java.sql.*;
import java.util.*;
import io.eforge.enterprise.generator.rendering.GeneratorOutputText;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.util.*;
import java.io.*;
import java.nio.file.*;
import com.alibaba.druid.DbType;
import com.alibaba.druid.sql.SQLUtils;
import com.alibaba.druid.sql.ast.statement.*;
import org.apache.velocity.app.Velocity;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.*;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;

class GeneratorOutputTextMysqlProbe {
 static int assertions;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 public static class Entry {
  Long id,parentId;String label;List<Entry> childLineList;
  public Long getId(){return id;}public void setId(Long value){id=value;}
  public Long getParentId(){return parentId;}public void setParentId(Long value){parentId=value;}
  public String getLabel(){return label;}public void setLabel(String value){label=value;}
  public List<Entry> getChildLineList(){return childLineList;}public void setChildLineList(List<Entry> value){childLineList=value;}
 }
 static GenTableColumn field(String name,String javaField,String type){
  var field=new GenTableColumn();field.setColumnName(name);field.setJavaField(javaField);field.setJavaType(type);
  field.setIsPk("0");field.setIsIncrement("0");field.setIsRequired("0");field.setIsQuery("1");field.setQueryType("EQ");return field;
 }
 static GenTable table(String category,String physical){
  var table=new GenTable();table.setTableName(physical);table.setClassName("RootText");table.setTplCategory(category);
  table.setTplWebType("element-plus");table.setPackageName("generated");table.setModuleName("test");table.setBusinessName("entry");table.setFunctionName("标签");table.setFormColNum(1);table.setOptions("{}");
  var id=field("编号`\"<&. --","id","Long");id.setIsPk("1");id.setIsIncrement("1");
  var label=field("列`\"<&. --","label","String");table.setColumns(List.of(id,label));table.setPkColumn(id);return table;
 }
 static void actualMapper(Connection connection)throws Exception{
  for(String category:List.of("crud","tree","sub")){
   var root=table(category,"实际_"+category+"`\"<&. select");
   var child=table("crud","子表`\"<&. select");child.setClassName("ChildLine");
   var parent=field("parent_id","parentId","Long");child.setColumns(List.of(child.getPkColumn(),parent,child.getColumns().get(1)));
   root.setSubTable(child);root.setSubTableName(child.getTableName());root.setSubTableFkName("parent_id");
   try(var sql=connection.createStatement()){
    sql.execute("CREATE TABLE "+GeneratorOutputText.mysqlIdentifier(root.getTableName())+" ("+GeneratorOutputText.mysqlIdentifier(root.getPkColumn().getColumnName())+" BIGINT PRIMARY KEY AUTO_INCREMENT,"+GeneratorOutputText.mysqlIdentifier(root.getColumns().get(1).getColumnName())+" TEXT CHARACTER SET utf8mb4)");
    if(category.equals("sub"))sql.execute("CREATE TABLE "+GeneratorOutputText.mysqlIdentifier(child.getTableName())+" ("+GeneratorOutputText.mysqlIdentifier(child.getPkColumn().getColumnName())+" BIGINT PRIMARY KEY AUTO_INCREMENT,parent_id BIGINT,"+GeneratorOutputText.mysqlIdentifier(child.getColumns().get(2).getColumnName())+" TEXT CHARACTER SET utf8mb4)");
   }
   VelocityInitializer.initVelocity();var writer=new StringWriter();Velocity.getTemplate("vm/xml/mapper.xml.vm","UTF-8").merge(VelocityUtils.prepareContext(root),writer);
   var configuration=new Configuration();configuration.getTypeAliasRegistry().registerAlias("RootText",Entry.class);configuration.getTypeAliasRegistry().registerAlias("ChildLine",Entry.class);
   var dataSource=new UnpooledDataSource("com.mysql.cj.jdbc.Driver",System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD")); configuration.setEnvironment(new Environment("probe",new JdbcTransactionFactory(),dataSource));
   new XMLMapperBuilder(new StringReader(writer.toString()),configuration,"generated-"+category+".xml",configuration.getSqlFragments()).parse();
   var factory=new SqlSessionFactoryBuilder().build(configuration);String namespace="generated.mapper.RootTextMapper.";
   for(String mode:List.of("","ANSI_QUOTES","NO_BACKSLASH_ESCAPES","ANSI_QUOTES,NO_BACKSLASH_ESCAPES")){
    var properties=new Properties();properties.setProperty("sessionVariables","sql_mode='"+mode+"'");properties.setProperty("jdbcCompliantTruncation","false");dataSource.setDriverProperties(properties);
    try(var session=factory.openSession(true)){
     try(var sql=session.getConnection().createStatement();var result=sql.executeQuery("SELECT @@SESSION.sql_mode")){check(result.next()&&new HashSet<>(Arrays.asList(result.getString(1).split(","))).equals(new HashSet<>(Arrays.asList(mode.split(",")))),"Driver connection did not start in the required SQL mode.");}
     var entry=new Entry();entry.label="中文😀\"'\\\n'); DROP TABLE injected; --";
     check(session.insert(namespace+"insertRootText",entry)==1&&entry.id!=null,"Generated insert/key mapping failed.");
     Entry read=session.selectOne(namespace+"selectRootTextById",entry.id);
     check(entry.label.equals(read.label),"Generated result mapping changed exact SQL data: category="+category+", mode="+mode+", expected="+entry.label.codePoints().boxed().toList()+", actual="+(read.label==null?null:read.label.codePoints().boxed().toList()));
     var filter=new Entry();filter.label=entry.label;
     check(session.selectList(namespace+"selectRootTextList",filter).size()==1,"Generated query predicate changed.");
     entry.label="updated\t<&`😀";check(session.update(namespace+"updateRootText",entry)==1,"Generated update failed.");
     read=session.selectOne(namespace+"selectRootTextById",entry.id);check(entry.label.equals(read.label),"Generated update/result mapping changed text.");
     if(category.equals("sub")){
      var line=new Entry();line.parentId=entry.id;line.label="child中文'\\<&😀";
      check(session.insert(namespace+"batchChildLine",Map.of("list",List.of(line)))==1,"Generated child insert failed.");
      read=session.selectOne(namespace+"selectRootTextById",entry.id);
      check(read.childLineList.size()==1&&line.label.equals(read.childLineList.get(0).label),"Generated nested child mapping failed.");
      check(session.delete(namespace+"deleteChildLineByParentIds",Map.of("array",new Long[]{entry.id}))==1,"Generated child delete failed.");
     }
     check(session.delete(namespace+"deleteRootTextByIds",Map.of("array",new Long[]{entry.id}))==1,"Generated batch delete failed.");
     check(session.selectOne(namespace+"selectRootTextById",entry.id)==null,"Generated delete did not target exact row.");
    }
   }
  }
  try(var sql=connection.createStatement();var result=sql.executeQuery("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")){check(result.next()&&result.getInt(1)==5,"Generated mapper executed an unintended DDL side effect.");}
 }
 static void actualMenu(Connection connection,Path repository)throws Exception{
  var baseline=SQLUtils.parseStatements(Files.readString(repository.resolve("sql/upstream/ry_20260417.sql")),DbType.mysql);
  try(var sql=connection.createStatement()){
   var ddl=baseline.stream().filter(statement->statement instanceof SQLCreateTableStatement table&&table.getName().getSimpleName().equals("sys_menu")).findFirst().orElseThrow();
   sql.execute(ddl.toString());
   // Only ALTERs from the actual migrations, never seed UPDATEs or unrelated DDL.
   for(String migration:List.of("V001__navigation_identity.sql","V011__menu_name_uniqueness.sql")){
    for(var statement:SQLUtils.parseStatements(Files.readString(repository.resolve("sql/migrations/"+migration)),DbType.mysql))if(statement instanceof SQLAlterTableStatement)sql.execute(statement.toString());
   }
   int modeIndex=0;
   for(String mode:List.of("","ANSI_QUOTES","NO_BACKSLASH_ESCAPES","ANSI_QUOTES,NO_BACKSLASH_ESCAPES")){
    sql.execute("SET SESSION sql_mode='"+mode+"'");
    var table=table("crud","menu_fixture");String title="菜单"+(modeIndex++)+"'\\中文\n'); DROP TABLE q; --";
    table.setFunctionName(title);table.setModuleName("模块'\\文本");table.setBusinessName("业务'\\中文");table.setOptions("{\"parentMenuId\":\"3\"}");
    var writer=new StringWriter();Velocity.getTemplate("vm/sql/sql.vm","UTF-8").merge(VelocityUtils.prepareContext(table),writer);
    var statements=SQLUtils.parseStatements(writer.toString(),DbType.mysql);check(statements.size()==7,"Generated menu changed statement count.");
    long rootId=0;int position=0;
    for(var statement:statements){
     boolean query=sql.execute(statement.toString());
     if(position==0){try(var result=sql.executeQuery("SELECT LAST_INSERT_ID()")){check(result.next(),"Generated root menu has no identifier.");rootId=result.getLong(1);}}
     else if(query){try(var result=sql.getResultSet()){check(result.next()&&result.getLong(1)==rootId,"Generated parent capture changed.");}}
     else check(sql.getUpdateCount()==1,"Generated button count changed.");position++;
    }
    try(var result=sql.executeQuery("SELECT * FROM sys_menu WHERE menu_id="+rootId)){
     check(result.next()&&title.equals(result.getString("menu_name")),"Generated root menu label changed.");
     check(result.getLong("parent_id")==3&&result.getInt("order_num")==1&&"C".equals(result.getString("menu_type")),"Generated root menu identity changed.");
     check(table.getBusinessName().equals(result.getString("path"))&&(table.getModuleName()+"/"+table.getBusinessName()+"/index").equals(result.getString("component")),"Generated route/component text changed.");
     check((table.getModuleName()+":"+table.getBusinessName()+":list").equals(result.getString("perms"))&&(title+"菜单").equals(result.getString("remark")),"Generated root permission/remark changed.");
     check(result.getString("menu_key")==null&&result.getString("route_id")==null,"Legacy menu falsely binds a React route.");
    }
    try(var result=sql.executeQuery("SELECT * FROM sys_menu WHERE parent_id="+rootId+" ORDER BY order_num")){
     int index=0;var labels=List.of("查询","新增","修改","删除","导出");var actions=List.of("query","add","edit","remove","export");
     while(result.next()){
      check(index<5&&"F".equals(result.getString("menu_type"))&&(title+labels.get(index)).equals(result.getString("menu_name")),"Generated child label/type changed.");
      check((table.getModuleName()+":"+table.getBusinessName()+":"+actions.get(index)).equals(result.getString("perms")),"Generated child permission changed.");index++;
     }
     check(index==5,"Generated menu lost original button controls.");
    }
   }
   try(var result=sql.executeQuery("SELECT COUNT(*) FROM sys_menu")){check(result.next()&&result.getInt(1)==24,"Generated menu has unexpected row side effects.");}
   try(var result=sql.executeQuery("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")){check(result.next()&&result.getInt(1)==6,"Generated menu has unintended DDL side effects.");}
  }
 }
 public static void main(String[] args)throws Exception{
  try(var connection=DriverManager.getConnection(System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD"));var sql=connection.createStatement()){
   check("中文😀".equals(new String(new int[]{0x4e2d,0x6587,0x1f600},0,3)),"Probe source Unicode was not decoded exactly.");
   String table=GeneratorOutputText.mysqlIdentifier("文本`table.with.dot"),column=GeneratorOutputText.mysqlIdentifier("值`column.with.dot");
   sql.execute("CREATE TABLE "+table+" ("+column+" LONGTEXT CHARACTER SET utf8mb4)");
   for(String mode:List.of("","ANSI_QUOTES","NO_BACKSLASH_ESCAPES","ANSI_QUOTES,NO_BACKSLASH_ESCAPES")){
    sql.execute("SET SESSION sql_mode='"+mode+"'");
    for(String value:Arrays.asList(null,"","引号'\"\\回车\r换行\n\t\0😀","');DROP TABLE injected;-- ","\\u000a</script>${danger}&#x0;\u2028\u2029")){
     try(var result=sql.executeQuery("SELECT "+GeneratorOutputText.mysqlLiteral(value))){check(result.next()&&Objects.equals(value,result.getString(1)),"Literal changed in actual MySQL mode.");}
     sql.executeUpdate("INSERT INTO "+table+" ("+column+") VALUES ("+GeneratorOutputText.mysqlLiteral(value)+")");
    }
   }
   try(var result=sql.executeQuery("SELECT COUNT(*) FROM "+table)){check(result.next()&&result.getInt(1)==20,"Rendered statements executed side effects or lost inserts.");}
   try(var result=sql.executeQuery("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")){check(result.next()&&result.getInt(1)==1,"Generated literal changed unrelated schema.");}
   actualMapper(connection);
   actualMenu(connection,Path.of(args[0]));
   System.out.println("PASS: "+assertions+" actual MySQL output context assertions; exact Unicode/NULL/control/string round trips under four SQL modes quoted identifier containment and actual original Mapper/menu SQL execution.");
  }
 }
}