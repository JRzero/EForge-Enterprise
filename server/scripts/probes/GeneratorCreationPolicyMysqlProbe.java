import java.util.Base64;
import java.nio.charset.StandardCharsets;
import io.eforge.enterprise.generator.util.GeneratorCreationAstPolicy;
class GeneratorCreationPolicyMysqlProbe {
 public static void main(String[] args) {
  String sql = "CREATE TABLE range_plain(id INT) PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE range_columns(id INT) PARTITION BY RANGE COLUMNS(id)(PARTITION p VALUES LESS THAN(10),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE year_bounds(created DATE) PARTITION BY RANGE(YEAR(created))(PARTITION p VALUES LESS THAN(2030),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE sub_options(id INT) ENGINE=InnoDB PARTITION BY RANGE(id) SUBPARTITION BY HASH(id)(PARTITION p VALUES LESS THAN(10)(SUBPARTITION sp ENGINE=InnoDB COMMENT='kept'));"
   +"CREATE TABLE cte_copy AS WITH q AS (SELECT id,name FROM owned_source) SELECT id,name FROM q;"
   +"CREATE TABLE like_copy LIKE owned_source;";
  StringBuilder prepared = new StringBuilder();
  for (var table : GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise")) prepared.append(table.sql()).append(";\n");
  System.out.print(Base64.getEncoder().encodeToString(prepared.toString().getBytes(StandardCharsets.UTF_8)));
 }
}