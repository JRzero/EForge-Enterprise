package io.eforge.enterprise.workflow;

import java.util.Map;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.flowable.spring.SpringProcessEngineConfiguration;
import org.flowable.spring.boot.ProcessEngineAutoConfiguration;
import org.flowable.spring.boot.ProcessEngineServicesAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import static org.assertj.core.api.Assertions.*;

class WorkflowEngineConfigurationTest {
    @Test void starterUsesDedicatedBoundedExecutorInsteadOfSharedApplicationPool(){
        new WorkflowLeaveServiceTest().runner.run(context->{
            var config=context.getBean(SpringProcessEngineConfiguration.class);
            var adapter=(org.flowable.common.spring.async.SpringAsyncTaskExecutor)config.getAsyncExecutor().getTaskExecutor();
            var pool=(org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor)adapter.getAsyncTaskExecutor();
            assertThat(pool.getThreadNamePrefix()).isEqualTo("eforge-workflow-job-");
            assertThat(pool.getCorePoolSize()).isEqualTo(1);assertThat(pool.getMaxPoolSize()).isEqualTo(2);
            assertThat(pool.getQueueCapacity()).isEqualTo(32);
        });
    }
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(Database.class, WorkflowEngineConfiguration.class)
        .withPropertyValues("flowable.idm.enabled=false", "flowable.eventregistry.enabled=false",
            "flowable.check-process-definitions=false", "flowable.async-executor-activate=false",
            "flowable.database-schema-update=true");

    @Test void packagedApplicationDefaultsDoNotCreateAnEngine() throws java.io.IOException {
        var yaml = new org.springframework.boot.env.YamlPropertySourceLoader().load("application",
            new org.springframework.core.io.FileSystemResource("../eforge-boot/src/main/resources/application.yml"));
        new ApplicationContextRunner().withUserConfiguration(Database.class, WorkflowEngineConfiguration.class)
            .withInitializer(context -> yaml.forEach(source -> context.getEnvironment().getPropertySources().addLast(source)))
            .run(context -> {
                assertThat(context).hasNotFailed().doesNotHaveBean(ProcessEngine.class);
                assertThat(context.getEnvironment().getProperty("flowable.database-schema-update")).isEqualTo("false");
                assertThat(context.getEnvironment().getProperty("flowable.check-process-definitions")).isEqualTo("false");
            });
    }

    @Test void disabledDoesNotCreateEngineOrEngineTables() {
        runner.withPropertyValues("flowable.process.enabled=false").run(context -> {
            assertThat(context).hasNotFailed().doesNotHaveBean(ProcessEngine.class);
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_name like 'ACT_%'", Long.class)).isZero();
        });
    }

    @ParameterizedTest @ValueSource(strings = {"approved", "rejected"})
    void samplePackageScenariosRunOnTheRealEngine(String scenarioName) throws Exception {
        var directory = java.nio.file.Path.of("../../workflows/leave-approval");
        String xml = java.nio.file.Files.readString(directory.resolve("process.bpmn20.xml"));
        var scenario = new com.fasterxml.jackson.databind.ObjectMapper().readTree(
            java.nio.file.Files.readString(directory.resolve("scenarios/" + scenarioName + ".json")));
        var checked = WorkflowBpmnPolicy.validate(xml);
        runner.withPropertyValues("flowable.process.enabled=true").run(context -> {
            assertThat(context).hasNotFailed();
            var engine = context.getBean(ProcessEngine.class);
            engine.getRepositoryService().createDeployment().addString("leave.bpmn20.xml", checked.xml()).deploy();
            var process = engine.getRuntimeService().startProcessInstanceByKey(checked.key());
            var task = engine.getTaskService().createTaskQuery().processInstanceId(process.getId()).taskCandidateGroup("role:2").singleResult();
            assertThat(task).isNotNull();
            assertThat(task.getTaskDefinitionKey()).isEqualTo(scenario.path("decisions").get(0).path("taskKey").asText());
            engine.getTaskService().claim(task.getId(), "2");
            engine.getTaskService().complete(task.getId(), Map.of("approved", scenario.path("decisions").get(0).path("approved").asBoolean()));
            assertThat(engine.getTaskService().createTaskQuery().processInstanceId(process.getId()).count()).isZero();
            assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(process.getId()).finished().count()).isEqualTo(1);
            assertThat(engine.getHistoryService().createHistoricActivityInstanceQuery().processInstanceId(process.getId())
                .activityId(scenario.path("expectedEnd").asText()).finished().count()).isEqualTo(1);
        });
    }

    @Test void realEngineAndBusinessWritesShareCommitAndRollback() {
        boolean mysql = System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL") != null;
        runner.withPropertyValues("flowable.process.enabled=true", "flowable.database-schema-update=" + !mysql).run(context -> {
            assertThat(context).hasNotFailed();
            var engine = context.getBean(ProcessEngine.class);
            var config = context.getBean(SpringProcessEngineConfiguration.class);
            assertThat(config.getBeans()).isEmpty();
            assertThat(config.isDisableIdmEngine()).isTrue();
            assertThat(config.isDisableEventRegistry()).isTrue();
            assertThat(config.isEnableSafeBpmnXml()).isTrue();
            assertThat(config.isAsyncExecutorActivate()).isFalse();
            assertThat(config.getDeploymentResources()).isEmpty();
            assertThat(config.getDataSource()).isInstanceOf(TransactionAwareDataSourceProxy.class);
            assertThat(((TransactionAwareDataSourceProxy) config.getDataSource()).getTargetDataSource())
                .isSameAs(context.getBean(DataSource.class));
            assertThat(config.getTransactionManager()).isSameAs(context.getBean(DataSourceTransactionManager.class));
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            jdbc.execute("create table business_probe (id varchar(64) primary key)");
            engine.getRepositoryService().createDeployment().addString("probe.bpmn20.xml", WorkflowBpmnPolicy.validate(BPMN).xml()).deploy();
            var tx = context.getBean(io.eforge.enterprise.workflow.api.WorkflowUnitOfWork.class);
            assertThatThrownBy(() -> tx.execute(() -> {
                jdbc.update("insert into business_probe values (?)", "rollback");
                engine.getRuntimeService().startProcessInstanceByKey("probe", "rollback", Map.of());
                throw new IllegalStateException("business failure");
            })).isInstanceOf(IllegalStateException.class);
            assertThat(jdbc.queryForObject("select count(*) from business_probe", Long.class)).isZero();
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
            assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().count()).isZero();
            tx.execute(() -> {
                jdbc.update("insert into business_probe values (?)", "commit");
                engine.getRuntimeService().startProcessInstanceByKey("probe", "commit", Map.of());
                return null;
            });
            assertThat(jdbc.queryForObject("select count(*) from business_probe", Long.class)).isEqualTo(1);
            var task = engine.getTaskService().createTaskQuery().singleResult();
            assertThatThrownBy(() -> tx.execute(() -> {
                engine.getTaskService().complete(task.getId());
                jdbc.update("delete from business_probe");
                throw new IllegalStateException("late business failure");
            })).isInstanceOf(IllegalStateException.class);
            assertThat(engine.getTaskService().createTaskQuery().taskId(task.getId()).count()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from business_probe", Long.class)).isEqualTo(1);
            tx.execute(() -> { engine.getTaskService().complete(task.getId()); return null; });
            assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().finished().count()).isEqualTo(1);
            assertThat(io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder.getDataSourceType()).isNull();
        });
    }

    @Configuration(proxyBeanMethods = false)
    @ImportAutoConfiguration({TaskExecutionAutoConfiguration.class,
        ProcessEngineAutoConfiguration.class, ProcessEngineServicesAutoConfiguration.class})
    static class Database {
        @Bean DataSource dataSource() {
            String url = System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL");
            if (url != null && !url.isBlank()) {
                var master = new DriverManagerDataSource(url, "root", System.getenv("EFORGE_WORKFLOW_TEST_JDBC_PASSWORD"));
                return new io.eforge.enterprise.framework.datasource.DynamicDataSource(master, Map.of("MASTER", master));
            }
            return new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        }
        @Bean DataSourceTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }
    }

    private static final String BPMN = """
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn" targetNamespace="https://eforge.io/workflow">
          <process id="probe" isExecutable="true">
            <startEvent id="start"/><sequenceFlow id="a" sourceRef="start" targetRef="review"/>
            <userTask id="review" name="Review" flowable:candidateGroups="role:2"/><sequenceFlow id="b" sourceRef="review" targetRef="end"/>
            <endEvent id="end"/>
          </process>
        </definitions>
        """;
}
