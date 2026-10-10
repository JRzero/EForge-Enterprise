package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowPackageMysqlTest {
    @Test void actualMySqlValidationConcurrentWritersAndAuditFailureRemainAtomic() throws Exception {
        Assumptions.assumeTrue(System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL") != null, "Requires owned MySQL fixture");
        var source = new WorkflowValidation.Request(Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")),
            List.of(new WorkflowValidation.Scenario("approved", List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"),
                new WorkflowValidation.Scenario("rejected", List.of(new WorkflowValidation.Decision("review",false)),"rejectedEnd")));
        var edit = new WorkflowPackages.Edit("中文 '; DROP TABLE ef_workflow_package; --", "leave", source);
        new ApplicationContextRunner().withUserConfiguration(WorkflowEngineConfigurationTest.Database.class, WorkflowEngineConfiguration.class)
            .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
                "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=false")
            .run(context -> {
                assertThat(context).hasNotFailed();
                var store = context.getBean(WorkflowPackages.class);
                var dataSource = context.getBean(DataSource.class);
                var jdbc = new JdbcTemplate(dataSource);
                var draft = store.create(edit, "1");
                assertThat(store.get(draft.id()).name()).isEqualTo(edit.name());
                assertThat(store.validate(draft.id(),1,"2").validatedRevision()).isEqualTo(1);
                assertThat(jdbc.queryForObject("select count(*) from ACT_RE_DEPLOYMENT",Long.class)).isZero();
                var counter = new java.util.concurrent.atomic.AtomicInteger();
                var pool = Executors.newFixedThreadPool(2, work -> new Thread(work,"workflow-package-writer-"+counter.incrementAndGet()));
                try (var lock = dataSource.getConnection()) {
                    lock.setAutoCommit(false);
                    try (var statement = lock.prepareStatement("select id from ef_workflow_package where id=? for update")) {
                        statement.setString(1,draft.id()); statement.executeQuery().close();
                    }
                    Callable<Integer> update = () -> {
                        try { store.update(draft.id(),1,edit,"2"); return 200; }
                        catch (ApiFailure failure) { return failure.status(); }
                    };
                    var first=pool.submit(update); var second=pool.submit(update);
                    boolean bothWaiting=false;
                    List<Map<String,Object>> observed=List.of();
                    long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
                    while(System.nanoTime()<deadline) {
                        // INNODB_TRX can expose a stale snapshot while the statements are already blocked.
                        // MySQL 8.4 documents data_lock_waits/data_locks as the current lock dependency source.
                        long waiting=jdbc.queryForObject("select count(distinct w.REQUESTING_ENGINE_TRANSACTION_ID) from performance_schema.data_lock_waits w join performance_schema.data_locks l on l.ENGINE=w.ENGINE and l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID where l.OBJECT_SCHEMA='eforge_workflow' and l.OBJECT_NAME='ef_workflow_package' and l.LOCK_STATUS='WAITING'",Long.class);
                        observed=jdbc.queryForList("select LOCK_MODE,LOCK_STATUS from performance_schema.data_locks where OBJECT_SCHEMA='eforge_workflow' and OBJECT_NAME='ef_workflow_package'");
                        if(waiting==2) {bothWaiting=true;break;}
                        Thread.sleep(50);
                    }
                    if (!bothWaiting) {
                        System.out.println("Owned fixture process states: "+jdbc.queryForList("select command,state,left(info,80) as statement_prefix from information_schema.processlist where db='eforge_workflow'"));
                        Thread.getAllStackTraces().forEach((thread,stack) -> {
                            if(thread.getName().startsWith("workflow-package-writer-")) System.out.println(thread.getName()+" "+thread.getState()+" "+Arrays.toString(stack));
                        });
                    }
                    lock.commit();
                    assertThat(bothWaiting).as("both real UPDATE statements waited on the same SQL row; observed=%s; done=%s/%s",observed,first.isDone(),second.isDone()).isTrue();
                    assertThat(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
                } finally { pool.shutdownNow(); }
                var after=store.get(draft.id());
                assertThat(after.revision()).isEqualTo(2);
                assertThat(after.validatedRevision()).isNull();
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_package_audit",Long.class)).isEqualTo(3);
                jdbc.execute("rename table ef_workflow_package_audit to workflow_package_fault_audit");
                try {
                    assertThatThrownBy(() -> store.update(draft.id(),2,edit,"1"))
                        .isInstanceOfSatisfying(ApiFailure.class,failure -> assertThat(failure.status()).isEqualTo(503));
                } finally { jdbc.execute("rename table workflow_package_fault_audit to ef_workflow_package_audit"); }
                assertThat(store.get(draft.id())).isEqualTo(after);
                assertThat(store.update(draft.id(),2,edit,"1").revision()).isEqualTo(3);
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_package_audit",Long.class)).isEqualTo(4);
            });
    }
}
