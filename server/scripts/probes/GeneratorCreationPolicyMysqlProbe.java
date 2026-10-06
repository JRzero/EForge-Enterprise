import java.util.*;
import java.nio.charset.StandardCharsets;
import io.eforge.enterprise.generator.util.GeneratorCreationAstPolicy;
class GeneratorCreationPolicyMysqlProbe {
 public static void main(String[] args) {
  int mode = args.length == 0 ? 0 : Integer.parseInt(args[0]);
  String sql = "CREATE TABLE range_plain(id INT) PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE range_columns(id INT) PARTITION BY RANGE COLUMNS(id)(PARTITION p VALUES LESS THAN(10),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE year_bounds(created DATE) PARTITION BY RANGE(YEAR(created))(PARTITION p VALUES LESS THAN(2030),PARTITION pmax VALUES LESS THAN(MAXVALUE));"
   +"CREATE TABLE sub_options(id INT) ENGINE=InnoDB PARTITION BY RANGE(id) SUBPARTITION BY HASH(id)(PARTITION p VALUES LESS THAN(10)(SUBPARTITION sp ENGINE=InnoDB COMMENT='kept'));"
   +"CREATE TABLE cte_copy AS WITH q AS (SELECT id,name FROM owned_source) SELECT id,name FROM q;"
   +"CREATE TABLE like_copy LIKE owned_source;"
   +"CREATE TABLE nonrecursive_copy AS WITH q AS (SELECT id FROM q) SELECT id FROM q;"
   +"CREATE TABLE chain_copy AS WITH first_q AS (SELECT id FROM owned_source),second_q AS (SELECT id FROM first_q) SELECT id FROM second_q;"
   +"CREATE TABLE forward_copy AS WITH first_q AS (SELECT id FROM second_q),second_q AS (SELECT id FROM owned_source) SELECT id FROM first_q;"
   +"CREATE TABLE nested_copy AS WITH q AS (SELECT id FROM owned_source) SELECT q.id AS outer_id,n.id AS inner_id FROM q JOIN (WITH q AS (SELECT id FROM second_q) SELECT id FROM q) n;"
   +"CREATE TABLE sibling_copy AS SELECT d.id AS inner_id,q.id AS physical_id FROM (WITH q AS (SELECT id FROM owned_source) SELECT id FROM q) d JOIN q;"
   +"CREATE TABLE qualified_copy AS WITH q AS (SELECT id FROM owned_source) SELECT real_q.id AS physical_id FROM eforge_enterprise.q real_q JOIN q;"
   +"CREATE TABLE recursive_copy AS WITH RECURSIVE q(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM q WHERE n<3) SELECT n FROM q;"
   +"CREATE TABLE mixed_case_copy AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM Q;";
  Map<String,Set<String>> expected = Map.ofEntries(
   Map.entry("cte_copy",Set.of("owned_source")),Map.entry("like_copy",Set.of("owned_source")),
   Map.entry("nonrecursive_copy",Set.of("q")),Map.entry("chain_copy",Set.of("owned_source")),
   Map.entry("forward_copy",Set.of("second_q","owned_source")),Map.entry("nested_copy",Set.of("owned_source","second_q")),
   Map.entry("sibling_copy",Set.of("owned_source","q")),Map.entry("qualified_copy",Set.of("owned_source","q")),
   Map.entry("recursive_copy",Set.of()),Map.entry("mixed_case_copy", mode == 0 ? Set.of("owned_source","Q") : Set.of("owned_source")));
  StringBuilder prepared = new StringBuilder();
  for (var table : GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise",mode)) {
   if (!table.references().equals(expected.getOrDefault(table.name(),Set.of()))) throw new AssertionError("Incorrect physical source projection: "+table.name());
   prepared.append(table.sql()).append(";\n");
  }
  System.out.print(Base64.getEncoder().encodeToString(prepared.toString().getBytes(StandardCharsets.UTF_8)));
 }
}