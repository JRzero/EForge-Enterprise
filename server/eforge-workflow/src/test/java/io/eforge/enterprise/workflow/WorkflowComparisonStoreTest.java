package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.assertj.core.api.Assertions.*;

class WorkflowComparisonStoreTest {
    final String pack=UUID.randomUUID().toString(),base=UUID.randomUUID().toString(),other=UUID.randomUUID().toString();
    final DriverManagerDataSource source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
    final JdbcTemplate jdbc=new JdbcTemplate(source);
    final WorkflowComparisonStore store=new WorkflowComparisonStore(source,new WorkflowTransactionBoundary(new DataSourceTransactionManager(source)));
    void prepare() throws Exception {
        for(String file:List.of("04-eforge-workflow.sql","05-eforge-workflow-releases.sql"))
            jdbc.execute(Files.readString(Path.of("../../sql/workflow",file)).replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin",""));
        String content="{\"bpmnXml\":\"<old/>\",\"scenarios\":[]}";
        jdbc.update("insert into ef_workflow_package values(?,?,'leave',9007199254740993,?,'new',null,null,'1','1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",pack,"新名称",content.replace("old","new"));
        jdbc.update("insert into ef_workflow_release values(?,?,1,?,'leave','old',?,'{}','definition','deployment','1',CURRENT_TIMESTAMP)",base,pack,"旧名称",content);
    }
    @Test void comparesExactCurrentDraftAndImmutableReleaseWithoutMutatingProofOrAudit() throws Exception {
        prepare();var result=store.compare(pack,base,null);
        assertThat(result.target().revision()).isEqualTo(9007199254740993L);
        assertThat(result.target().kind()).isEqualTo("DRAFT");
        assertThat(result.fields().stream().filter(f->f.changed()).map(f->f.name())).containsExactly("name","bpmnXml");
        assertThat(result.fields().stream().filter(f->f.name().equals("bpmnXml")).findFirst().orElseThrow().before()).isEqualTo("<old/>");
        assertThat(store.compare(pack,base,base).fields()).allMatch(f->!f.changed());
        jdbc.update("update ef_workflow_package set name='再修改',revision=revision+1 where id=?",pack);
        assertThat(store.compare(pack,base,base).target().revision()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from ef_workflow_package_audit",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from ef_workflow_release_audit",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select validated_revision from ef_workflow_package where id=?",Long.class,pack)).isNull();
    }
    @Test void rejectsForeignReleaseAndSafelyHandlesBrokenStoredJsonAndSql() throws Exception {
        prepare();
        jdbc.update("insert into ef_workflow_release select ?,?,2,name,business_type,content_digest,source_json,validation_json,'other-definition','other-deployment',published_by,published_at from ef_workflow_release where id=?",other,UUID.randomUUID().toString(),base);
        for(String[] ids:List.of(new String[]{other,null},new String[]{base,other}))
            assertThatThrownBy(()->store.compare(pack,ids[0],ids[1])).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(404));
        jdbc.update("update ef_workflow_package set source_json='private-invalid-json'");
        assertThatThrownBy(()->store.compare(pack,base,null)).isInstanceOfSatisfying(ApiFailure.class,f->{assertThat(f.status()).isEqualTo(500);assertThat(f.getMessage()).doesNotContain("private");});
        jdbc.execute("alter table ef_workflow_release rename to private_release");
        assertThatThrownBy(()->store.compare(pack,base,null)).isInstanceOfSatisfying(ApiFailure.class,f->{assertThat(f.status()).isEqualTo(503);assertThat(f.getMessage()).doesNotContain("private_release");});
    }
}
