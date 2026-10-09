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
    EngineConfigurationConfigurer<SpringProcessEngineConfiguration> workflowEngineRestrictions() {
        return configuration -> {
            configuration.setBeans(Map.of());
            configuration.setEnableSafeBpmnXml(true);
            configuration.setDisableIdmEngine(true);
            configuration.setDisableEventRegistry(true);
            configuration.setDeploymentResources(new Resource[0]);
            configuration.setAsyncExecutorActivate(false);
            configuration.setAsyncHistoryExecutorActivate(false);
        };
    }
}
