package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.util.GeneratorCreationBatchParser;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorCreationBatchParserTest {
    List<GeneratorCreationBatchParser.ParsedTable> parse(String sql) {return GeneratorCreationBatchParser.parse(sql,"eforge_enterprise");}
    void refuses(String sql) {var failure=assertThrows(ApiFailure.class,()->parse(sql));assertEquals(400,failure.status());assertEquals("GENERATOR_CREATE_SQL_INVALID",failure.code());assertFalse(failure.getMessage().contains("private"));}
    @Test void legalUnicodeCommentsAndLiteralKeywordsRemainData() {
        var result=parse("-- ignored DROP text\nCREATE TABLE `创建_订单` (`id` BIGINT PRIMARY KEY AUTO_INCREMENT, `name` VARCHAR(64) COMMENT 'private; /*!50100 DROP */ select sleep()') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='quoted ''literal'''");
        assertEquals("创建_订单",result.get(0).name());assertEquals(2,result.get(0).astCopy().getColumnDefinitions().size());
    }
    @Test void completeBatchRejectsMixedStatementsEvenAfterValidCreate() {
        for(var suffix:List.of("DROP TABLE private_table","INSERT INTO private_table VALUES(1)","SELECT 1","ALTER TABLE private_table ADD x INT","SET @x=1","CREATE VIEW private_view AS SELECT 1")) refuses("CREATE TABLE owned_first(id BIGINT);"+suffix);
    }
    @Test void allTargetsBelongToCurrentSchemaAndDuplicatesFail() {
        for(var sql:List.of("CREATE TABLE private_schema.owned(id INT)","CREATE TABLE a.b.owned(id INT)","CREATE TABLE owned(id INT);CREATE TABLE OWNED(id INT)","CREATE TABLE `"+"x".repeat(65)+"`(id INT)")) refuses(sql);
        assertEquals("owned",parse("CREATE TABLE `eforge_enterprise`.`owned`(id INT)").get(0).name());
    }
    @Test void likeAndJoinedNestedCtasPreserveLocalReferences() {
        var result=parse("CREATE TABLE owned_copy LIKE eforge_enterprise.owned_source; CREATE TABLE owned_join AS SELECT a.id FROM owned_source a JOIN owned_other b ON a.id=b.id WHERE EXISTS(SELECT 1 FROM owned_nested n WHERE n.id=a.id)");
        assertEquals(Set.of("owned_source"),result.get(0).references());assertEquals(Set.of("owned_source","owned_other","owned_nested"),result.get(1).references());assertNotNull(result.get(1).astCopy().getSelect());
    }
    @Test void cteAndForeignKeyReferencesAreTraversed() {
        var result=parse("CREATE TABLE owned_child(id BIGINT,parent_id BIGINT,CONSTRAINT fk FOREIGN KEY(parent_id) REFERENCES eforge_enterprise.owned_parent(id));CREATE TABLE owned_cte AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM q");
        assertEquals(Set.of("owned_parent"),result.get(0).references());assertTrue(result.get(1).references().contains("owned_source"));assertTrue(result.get(1).astCopy().toString().contains("WITH"));
    }
    @Test void foreignSchemasCannotHideInLikeJoinsSubqueriesCtesOrForeignKeys() {
        for(var sql:List.of("CREATE TABLE owned LIKE private_schema.source","CREATE TABLE owned AS SELECT a.id FROM owned_source a JOIN private_schema.source b ON a.id=b.id","CREATE TABLE owned AS SELECT (SELECT id FROM private_schema.source LIMIT 1)","CREATE TABLE owned AS WITH q AS (SELECT id FROM private_schema.source) SELECT id FROM q","CREATE TABLE owned(id INT,p INT,FOREIGN KEY(p) REFERENCES private_schema.source(id))")) refuses(sql);
    }
    @Test void astCopiesAndReturnedCollectionsCannotMutateTheSnapshot() {
        var result=parse("CREATE TABLE IF NOT EXISTS owned_copy LIKE owned_source");var table=result.get(0);table.astCopy().setName("mutated");table.astCopy().setIfNotExists(false);
        assertEquals("owned_copy",table.astCopy().getTableName());assertTrue(table.astCopy().isIfNotExists());assertThrows(UnsupportedOperationException.class,()->result.clear());assertThrows(UnsupportedOperationException.class,()->table.references().clear());
    }
    @Test void executableCommentsAndOptimizerHintsFailOutsideQuotedData() {
        for(var sql:List.of("/*!50100 CREATE TABLE owned(id INT) */","CREATE /*+ private_hint */ TABLE owned(id INT)","CREATE TABLE owned AS SELECT /*+ private_hint */ id FROM owned_source","CREATE TABLE owned(id INT) /*!50100 ENGINE=InnoDB */")) refuses(sql);
    }
    @Test void originalTypesKeysOptionsAndPartitionsRemainInAst() {
        var result=parse("CREATE TABLE owned(id BIGINT NOT NULL AUTO_INCREMENT,amount DECIMAL(18,2),payload JSON,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(id),KEY amount_index(amount),CHECK(amount>=0)) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='original' PARTITION BY HASH(id) PARTITIONS 2");
        var table=result.get(0).astCopy();assertEquals(4,table.getColumnDefinitions().size());assertNotNull(table.getPartitioning());assertFalse(table.getTableOptions().isEmpty());
    }
    @Test void malformedEmptyOversizedAndExcessiveBatchInputsFailSafely() {
        for(var sql:Arrays.asList(null,"","-- no statement","CREATE TABLE private(","CREATE TABLE owned(id INT) /* unclosed", "CREATE TABLE owned(id INT COMMENT 'unclosed)"," ".repeat(65_537))) refuses(sql);
        refuses(java.util.stream.IntStream.range(0,101).mapToObj(i->"CREATE TABLE owned_"+i+"(id INT);").collect(java.util.stream.Collectors.joining()));
        refuses("CREATE TABLE owned AS SELECT "+"(".repeat(65)+"1"+")".repeat(65));
    }
    @Test void inlineReferenceAndSchemaCaseCannotBypassTheLocalBoundary() {
        assertEquals(Set.of("owned_parent"),parse("CREATE TABLE owned_child(id BIGINT REFERENCES eforge_enterprise.owned_parent(id))").get(0).references());
        refuses("CREATE TABLE owned_child(id BIGINT REFERENCES private_schema.owned_parent(id))");
        refuses("CREATE TABLE EFORGE_ENTERPRISE.owned(id INT)");
        refuses("CREATE TABLE owned LIKE EFORGE_ENTERPRISE.owned_source");
    }
    @Test void nestedAstCopiesAlsoRemainIndependent() {
        var table=parse("CREATE TABLE owned_copy AS SELECT id FROM owned_source").get(0);
        var firstCopy=table.astCopy();firstCopy.getSelect().getFirstQueryBlock().setFrom(new com.alibaba.druid.sql.ast.expr.SQLIdentifierExpr("mutated"));
        assertTrue(table.astCopy().getSelect().toString().contains("owned_source"));
        assertFalse(table.astCopy().getSelect().toString().contains("mutated"));
    }
    @Test void malformedSchemaContextAndInvalidPhysicalIdentifiersFailSafely() {
        assertThrows(ApiFailure.class,()->GeneratorCreationBatchParser.parse("CREATE TABLE owned(id INT)",null));
        for(var name:List.of("../private","private/name","private.name","private ")) refuses("CREATE TABLE `"+name+"`(id INT)");
    }    @Test void recursiveUnaryAndCaseInputsAreRejectedBeforeParserStackExhaustion() {
        for(var prefix:List.of("NOT ","! ","~ ","- ","+ ","NOT /* harmless comment */ "))
            assertThrows(ApiFailure.class, () -> parse("CREATE TABLE owned AS SELECT "+prefix.repeat(2048)+"1"), "recursive prefix: " + prefix);
        refuses("CREATE TABLE owned AS SELECT "+"CASE WHEN 1 THEN ".repeat(128)+"1"+" ELSE 0 END".repeat(128));
        refuses("CREATE TABLE owned AS SELECT "+("NOT ".repeat(32)+"CASE WHEN 1 THEN ").repeat(40)+"1"+" ELSE 0 END".repeat(40));
        assertEquals("owned",parse("CREATE TABLE owned(id INT COMMENT '"+"NOT ".repeat(2048)+"')").get(0).name());
    }}