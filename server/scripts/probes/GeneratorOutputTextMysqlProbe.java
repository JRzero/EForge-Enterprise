import java.sql.*;
import java.util.*;
import io.eforge.enterprise.generator.rendering.GeneratorOutputText;

class GeneratorOutputTextMysqlProbe {
 static int assertions;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
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
   System.out.println("PASS: "+assertions+" actual MySQL output context assertions; exact Unicode/NULL/control/string round trips under four SQL modes and quoted identifier containment.");
  }
 }
}