package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.util.GeneratorCreationAstPolicy;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorCreationAstPolicyTest {
    List<GeneratorCreationAstPolicy.PreparedTable> prepare(String sql) {return GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise");}
    void refuses(String sql) {var failure=assertThrows(ApiFailure.class,()->prepare(sql),sql);assertEquals(400,failure.status());assertFalse(failure.getMessage().contains("private"));}
    @Test void knownNativeDefaultsComputedColumnsAggregatesAndCtasRemainAvailable() {
        var result=prepare("CREATE TABLE owned(id BIGINT AUTO_INCREMENT PRIMARY KEY,created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,amount DECIMAL(18,2),rounded DECIMAL(18,2) AS (ROUND(amount,2)) STORED) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4; CREATE TABLE owned_summary AS SELECT COALESCE(MAX(amount),0) AS total, COUNT(*) AS count FROM owned_source");
        assertEquals(2,result.size());assertTrue(result.get(0).sql().contains("ROUND"));assertEquals(Set.of("owned_source"),result.get(1).references());
    }
    @Test void ordinaryCommentsAndLiteralFunctionAndPathTextRemainData() {
        var result=prepare("CREATE TABLE owned(id INT COMMENT 'private sleep() /outside; GET_LOCK() /*! hinted */') COMMENT='DATA DIRECTORY=/outside'");assertTrue(result.get(0).sql().contains("GET_LOCK()"));
    }
    @Test void unknownStoredQualifiedQuotedAndSideEffectFunctionsFailClosed() {
        for(var call:List.of("SLEEP(1)","BENCHMARK(100,1)","GET_LOCK('private',1)","RELEASE_LOCK('private')","LOAD_FILE('/private')","private_function()","eforge_enterprise.CONCAT('a','b')","`CONCAT`('a','b')","LAST_INSERT_ID(1)","ROW_COUNT()")) refuses("CREATE TABLE owned AS SELECT "+call+" AS value");
    }
    @Test void badFunctionCannotHideInDefaultsGeneratedColumnsOrSubqueries() {
        refuses("CREATE TABLE owned(id INT DEFAULT (private_function()))");refuses("CREATE TABLE owned(id INT,generated INT AS (private_function(id)))");refuses("CREATE TABLE owned AS SELECT (SELECT SLEEP(1)) AS value");
    }
    @Test void variablesAssignmentsOutfileAndLockingReadsAreRefused() {
        for(var select:List.of("SELECT @private AS x","SELECT @private:=1 AS x","SELECT 1 INTO OUTFILE '/private'","SELECT 1 INTO DUMPFILE '/private'","SELECT id FROM owned_source FOR UPDATE","SELECT id FROM owned_source LOCK IN SHARE MODE","SELECT SQL_CALC_FOUND_ROWS id FROM owned_source")) refuses("CREATE TABLE owned AS "+select);
    }
    @Test void externalStoragePathsAndUnknownOptionsAreRefused() {
        for(var suffix:List.of("DATA DIRECTORY='/private'","INDEX DIRECTORY='/private'","CONNECTION='mysql://private/remote' ENGINE=FEDERATED","ENGINE=NDB","TABLESPACE private_space","ENGINE=private_engine","UNION=(private_source)")) refuses("CREATE TABLE owned(id INT) "+suffix);
    }
    @Test void nestedPartitionPathsAndEnginesAreChecked() {
        refuses("CREATE TABLE owned(id INT) PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10) DATA DIRECTORY='/private')");
        refuses("CREATE TABLE owned(id INT) PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10) ENGINE=FEDERATED)");
        assertEquals(1,prepare("CREATE TABLE owned(id INT) ENGINE=InnoDB PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10) ENGINE=InnoDB)").size());
    }
    @Test void localLikeAndCteArePreservedAndIfNotExistsCannotHideAConflict() {
        var result=prepare("CREATE TABLE IF NOT EXISTS owned_copy LIKE eforge_enterprise.owned_source; CREATE TABLE owned_cte AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM q");assertFalse(result.get(0).sql().contains("IF NOT EXISTS"));assertTrue(result.get(0).sql().contains("LIKE"));assertTrue(result.get(1).sql().contains("WITH"));
    }
    @Test void wholeBatchIsRejectedBeforeAnyPreparedResultCanEscape() {
        refuses("CREATE TABLE owned_first(id INT);CREATE TABLE owned_second AS SELECT SLEEP(1) AS x");
    }
    @Test void temporaryTablesCannotBeImportedAsPersistentPhysicalOwnership() {refuses("CREATE TEMPORARY TABLE owned(id INT)");}
    @Test void nativeSpecialSyntaxCannotHideUnsafeExpressions() {
        for (var expression : List.of("TRIM('x' FROM private_function())", "SUBSTRING('abc' FROM private_function())", "SUBSTRING('abc' FROM 1 FOR private_function())", "EXTRACT(YEAR FROM private_function())", "CONVERT(private_function() USING utf8mb4)"))
            refuses("CREATE TABLE owned AS SELECT " + expression + " AS value");
        var result = prepare("CREATE TABLE owned AS SELECT TRIM('x' FROM 'xxsafe'), SUBSTRING('abc' FROM 1 FOR 2), EXTRACT(YEAR FROM CURRENT_TIMESTAMP), CONVERT('safe' USING utf8mb4)");
        assertEquals(1, result.size());
        assertTrue(result.get(0).sql().contains("TRIM"));
    }
    @Test void partitionExpressionKindsAndBoundsSurvivePreparation() {
        var result = prepare("CREATE TABLE owned(created DATE,id INT) PARTITION BY RANGE(YEAR(created))(PARTITION p VALUES LESS THAN(2030),PARTITION pmax VALUES LESS THAN(MAXVALUE))");
        assertTrue(result.get(0).sql().contains("RANGE (YEAR(created))"), result.get(0).sql());
        assertFalse(result.get(0).sql().contains("RANGE COLUMNS"), result.get(0).sql());
    }
    @Test void legalSubpartitionOptionsAreNotSilentlyDropped() {
        var result = prepare("CREATE TABLE owned(id INT) ENGINE=InnoDB PARTITION BY RANGE(id) SUBPARTITION BY HASH(id)(PARTITION p VALUES LESS THAN(10)(SUBPARTITION sp ENGINE=InnoDB COMMENT='kept'))");
        assertTrue(result.get(0).sql().contains("ENGINE = InnoDB"), result.get(0).sql());
        assertTrue(result.get(0).sql().contains("COMMENT = 'kept'"), result.get(0).sql());
    }
    @Test void rangeAndRangeColumnsRemainDistinct() {
        assertTrue(prepare("CREATE TABLE owned(id INT) PARTITION BY RANGE(id)(PARTITION p VALUES LESS THAN(10))").get(0).sql().contains("RANGE (id)"));
        assertTrue(prepare("CREATE TABLE owned(id INT) PARTITION BY RANGE COLUMNS(id)(PARTITION p VALUES LESS THAN(10))").get(0).sql().contains("RANGE COLUMNS (id)"));
    }
    @Test void ordinaryCteNamesAreNotPhysicalDatabaseDependencies() {
        assertEquals(Set.of("owned_source"), prepare("CREATE TABLE owned AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM q").get(0).references());
    }
    @Test void nonRecursiveSameNameAndForwardNamesRemainPhysicalDependencies() {
        assertEquals(Set.of("q"), prepare("CREATE TABLE owned AS WITH q AS (SELECT id FROM q) SELECT id FROM q").get(0).references());
        assertEquals(Set.of("source"), prepare("CREATE TABLE owned AS WITH first_q AS (SELECT id FROM source),second_q AS (SELECT id FROM first_q) SELECT id FROM second_q").get(0).references());
        assertEquals(Set.of("second_q","source"), prepare("CREATE TABLE owned AS WITH first_q AS (SELECT id FROM second_q),second_q AS (SELECT id FROM source) SELECT id FROM first_q").get(0).references());
    }
    @Test void nestedCteScopeDoesNotLeakIntoSiblingOrOuterQueries() {
        assertEquals(Set.of("outer_source","inner_source"), prepare("CREATE TABLE owned AS WITH q AS (SELECT id FROM outer_source) SELECT q.id FROM q JOIN (WITH q AS (SELECT id FROM inner_source) SELECT id FROM q) nested_q ON q.id=nested_q.id").get(0).references());
        assertEquals(Set.of("owned_source","q"), prepare("CREATE TABLE owned AS SELECT d.id FROM (WITH q AS (SELECT id FROM owned_source) SELECT id FROM q) d JOIN q ON d.id=q.id").get(0).references());
    }
    @Test void qualificationCannotBeHiddenByCteAliasAndRecursiveSelfIsNotPhysical() {
        assertEquals(Set.of("owned_source","q"), prepare("CREATE TABLE owned AS WITH q AS (SELECT id FROM owned_source) SELECT real_q.id FROM eforge_enterprise.q real_q JOIN q ON real_q.id=q.id").get(0).references());
        assertEquals(Set.of(), prepare("CREATE TABLE owned AS WITH RECURSIVE q(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM q WHERE n<3) SELECT n FROM q").get(0).references());
    }
    @Test void cteIdentifierCaseFollowsDatabaseModeAndDuplicatesAreRejected() {
        var sql = "CREATE TABLE owned AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM Q";
        assertEquals(Set.of("owned_source","Q"), GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise",0).get(0).references());
        assertEquals(Set.of("owned_source"), GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise",1).get(0).references());
        assertEquals(Set.of("owned_source"), GeneratorCreationAstPolicy.prepare(sql,"eforge_enterprise",2).get(0).references());
        refuses("CREATE TABLE owned AS WITH q AS (SELECT 1),q AS (SELECT 2) SELECT * FROM q");
        assertThrows(ApiFailure.class, () -> GeneratorCreationAstPolicy.prepare("CREATE TABLE owned(id INT)","eforge_enterprise",3));
    }
    @Test void quotedCteNamesAreScopedButForeignKeysRemainPhysical() {
        assertEquals(Set.of("owned_source"), prepare("CREATE TABLE owned AS WITH `临时_查询` AS (SELECT id FROM owned_source) SELECT id FROM `临时_查询`").get(0).references());
        assertEquals(Set.of("owned_source","q"), prepare("CREATE TABLE owned(id INT,p INT,FOREIGN KEY(p) REFERENCES q(id)) AS WITH q AS (SELECT id FROM owned_source) SELECT id,0 AS p FROM q").get(0).references());
    }
    @Test void preparedResultsAndReferencesAreImmutable() {
        var result=prepare("CREATE TABLE owned_copy LIKE owned_source");assertThrows(UnsupportedOperationException.class,()->result.clear());assertThrows(UnsupportedOperationException.class,()->result.get(0).references().clear());
    }
    @Test void unsafeFunctionsCannotHideInCteOrSubpartitionMetadata() {
        refuses("CREATE TABLE owned AS WITH q AS (SELECT SLEEP(1) AS x) SELECT x FROM q");
        refuses("CREATE TABLE owned(id INT) PARTITION BY RANGE(id) SUBPARTITION BY HASH(id)(PARTITION p VALUES LESS THAN(10)(SUBPARTITION sp DATA DIRECTORY='/private'))");
    }}