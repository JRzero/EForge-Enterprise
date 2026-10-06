package io.eforge.enterprise.web.controller.api.v1.tool;

import java.io.StringWriter;
import com.alibaba.druid.sql.SQLUtils;
import com.alibaba.druid.DbType;
import com.alibaba.druid.sql.ast.statement.SQLInsertStatement;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.Velocity;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.generator.util.VelocityInitializer;
import io.eforge.enterprise.generator.rendering.GeneratorOutputText;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorMenuSqlTextTest {
 @Test void actualMenuTemplateContainsOnlyTheOriginalSevenStatements(){
  VelocityInitializer.initVelocity();var context=new VelocityContext();context.put("outputText",GeneratorOutputText.INSTANCE);
  for(String field:new String[]{"functionName","businessName","moduleName","permissionPrefix","parentMenuId"})context.put(field,"中文'\\\n'); DROP TABLE injected; --");
  var writer=new StringWriter();Velocity.getTemplate("vm/sql/sql.vm","UTF-8").merge(context,writer);
  var statements=SQLUtils.parseStatements(writer.toString(),DbType.mysql);
  assertEquals(7,statements.size());assertEquals(6,statements.stream().filter(SQLInsertStatement.class::isInstance).count());
  for(var statement:statements)assertFalse(statement instanceof com.alibaba.druid.sql.ast.statement.SQLDropTableStatement);
  assertFalse(writer.toString().contains("DROP TABLE injected"));
 }
}