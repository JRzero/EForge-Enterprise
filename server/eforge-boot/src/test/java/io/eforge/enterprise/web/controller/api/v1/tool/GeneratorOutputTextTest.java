package io.eforge.enterprise.web.controller.api.v1.tool;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.net.URLClassLoader;
import javax.tools.ToolProvider;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.rendering.GeneratorOutputText;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorOutputTextTest {
 @TempDir Path directory;
 private static final String PAYLOAD="'\"\\u000a\r\n\t\0中文😀</script>&${danger}*/ public static int injected=1; //";
 @Test void generatedJavaActuallyCompilesAndRoundTripsHostileLiteralAndComment()throws Exception{
  String source="/** "+GeneratorOutputText.javaComment(PAYLOAD)+" */\npublic class GeneratedText { public static String value(){return "+GeneratorOutputText.javaLiteral(PAYLOAD)+";} }";
  Path file=directory.resolve("GeneratedText.java");Files.writeString(file,source,StandardCharsets.UTF_8);
  var diagnostics=new java.io.ByteArrayOutputStream();
  assertEquals(0,ToolProvider.getSystemJavaCompiler().run(null,diagnostics,diagnostics,"-encoding","UTF-8","-d",directory.toString(),file.toString()),diagnostics.toString(StandardCharsets.UTF_8));
  try(var loader=new URLClassLoader(new java.net.URL[]{directory.toUri().toURL()},null)){
   var type=loader.loadClass("GeneratedText");assertEquals(PAYLOAD,type.getMethod("value").invoke(null));assertEquals(0,type.getDeclaredFields().length);
  }
 }
 @Test void jsonRoundTripsAndCannotCloseHtmlScript()throws Exception{
  String encoded=GeneratorOutputText.jsonLiteral(PAYLOAD+"\u2028\u2029");
  assertEquals(PAYLOAD+"\u2028\u2029",new ObjectMapper().readValue(encoded,String.class));
  assertFalse(encoded.contains("</script>"));assertFalse(encoded.contains("&"));assertFalse(encoded.contains("\u2028"));
  assertEquals("null",GeneratorOutputText.jsonLiteral(null));
 }
 @Test void actualXmlParserPreservesAttributeWhitespaceAndMetacharacters()throws Exception{
  String value="中文😀\t\n\r<&>'\"";
  var factory=DocumentBuilderFactory.newInstance();factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
  var doc=factory.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(("<row value=\""+GeneratorOutputText.xml(value)+"\">"+GeneratorOutputText.xml(value)+"</row>").getBytes(StandardCharsets.UTF_8)));
  assertEquals(value,doc.getDocumentElement().getAttribute("value"));assertEquals(value,doc.getDocumentElement().getTextContent());
  assertThrows(ApiFailure.class,()->GeneratorOutputText.xml("\0"));
 }
 @Test void actualSpelParserTreatsExecutionTextAsData(){
  assertEquals(PAYLOAD,new SpelExpressionParser().parseExpression(GeneratorOutputText.spelLiteral(PAYLOAD)).getValue(String.class));
  String attack="');T(java.lang.System).exit(0);('";
  assertEquals(attack,new SpelExpressionParser().parseExpression(GeneratorOutputText.spelLiteral(attack)).getValue(String.class));
 }
 @Test void identifiersAndInvalidUnicodeHaveExplicitBoundaries(){
  assertEquals("中文值",GeneratorOutputText.javaIdentifier("中文值"));
  assertEquals("record",GeneratorOutputText.javaIdentifier("record"));
  assertEquals("`quoted``name.with.dot`",GeneratorOutputText.mysqlIdentifier("quoted`name.with.dot"));
  for(String bad:java.util.List.of("class","a.b","a;bad","9name"))assertThrows(ApiFailure.class,()->GeneratorOutputText.javaIdentifier(bad));
  for(String bad:java.util.List.of("\ud800","\udfff")){
   assertThrows(ApiFailure.class,()->GeneratorOutputText.javaLiteral(bad));assertThrows(ApiFailure.class,()->GeneratorOutputText.jsonLiteral(bad));
   assertThrows(ApiFailure.class,()->GeneratorOutputText.mysqlLiteral(bad));assertThrows(ApiFailure.class,()->GeneratorOutputText.xml(bad));
  }
  assertEquals("null",GeneratorOutputText.javaLiteral(null));assertEquals("NULL",GeneratorOutputText.mysqlLiteral(null));
  assertEquals("CONVERT(X'' USING utf8mb4)",GeneratorOutputText.mysqlLiteral(""));
 }
}