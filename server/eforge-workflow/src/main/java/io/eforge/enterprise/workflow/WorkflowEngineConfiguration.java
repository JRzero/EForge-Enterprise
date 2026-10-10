package io.eforge.enterprise.workflow;

import java.util.Map;
import org.flowable.spring.SpringProcessEngineConfiguration;
import org.flowable.spring.boot.EngineConfigurationConfigurer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

/** Restricts the official engine; identity and publication remain framework responsibilities. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "flowable.process.enabled", havingValue = "true")
public class WorkflowEngineConfiguration {
    @Bean @org.flowable.spring.boot.process.Process
    org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor workflowJobTaskExecutor() {
        var executor=new org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);executor.setMaxPoolSize(2);executor.setQueueCapacity(32);
        executor.setThreadNamePrefix("eforge-workflow-job-");
        executor.setWaitForTasksToCompleteOnShutdown(true);executor.setAwaitTerminationSeconds(10);
        return executor;
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowJobs workflowJobs(javax.sql.DataSource dataSource,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions,org.flowable.engine.ProcessEngine engine) {
        return new WorkflowJobService(dataSource,transactions,engine);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowComparisons workflowComparisons(javax.sql.DataSource dataSource,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions) {
        return new WorkflowComparisonStore(dataSource,transactions);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowLeaves workflowLeaves(javax.sql.DataSource dataSource,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions,org.flowable.engine.ProcessEngine engine) {
        return new WorkflowLeaveService(dataSource,transactions,engine);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowReleases workflowReleases(javax.sql.DataSource dataSource,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions,
        io.eforge.enterprise.workflow.api.WorkflowPackages packages,org.flowable.engine.ProcessEngine engine) {
        return new WorkflowReleaseStore(dataSource,transactions,packages,engine);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowPackages workflowPackages(javax.sql.DataSource dataSource,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions,
        io.eforge.enterprise.workflow.api.WorkflowValidation validation) {
        return new WorkflowPackageStore(dataSource, transactions, validation);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowValidation workflowValidation(org.flowable.engine.ProcessEngine engine,
        io.eforge.enterprise.workflow.api.WorkflowUnitOfWork transactions) {
        return new WorkflowScenarioValidation(engine, transactions);
    }
    @Bean
    io.eforge.enterprise.workflow.api.WorkflowUnitOfWork workflowUnitOfWork(
        org.springframework.transaction.PlatformTransactionManager transactions) {
        return new WorkflowTransactionBoundary(transactions);
    }
    // Official extension point: flowable-7.2.0 ProcessEngineServicesAutoConfiguration.
    @Bean
    EngineConfigurationConfigurer<SpringProcessEngineConfiguration> workflowEngineRestrictions(javax.sql.DataSource dataSource,
        @org.springframework.beans.factory.annotation.Value("${eforge.workflow.async-enabled:false}") boolean asyncEnabled) {
        return configuration -> {
            configuration.setBeans(Map.of());
            configuration.setEnableSafeBpmnXml(true);
            configuration.setDisableIdmEngine(true);
            configuration.setDisableEventRegistry(true);
            configuration.setDeploymentResources(new Resource[0]);
            configuration.setAsyncExecutorActivate(asyncEnabled);
            configuration.setEventListeners(java.util.List.of(new WorkflowAsyncStart(configuration,dataSource)));
            configuration.setAsyncHistoryExecutorActivate(false);
        };
    }
}
