package io.eforge.enterprise.workflow.api;

import java.util.List;

/** Engine-independent validation contract shared by HTTP and package publication. */
public interface WorkflowValidation {
    Result validate(Request request);
    record Decision(String taskKey, boolean approved) { }
    record Scenario(String name, List<Decision> decisions, String expectedEnd) { }
    record Request(String bpmnXml, List<Scenario> scenarios) { }
    record ScenarioResult(String name, List<String> completedTasks, String endActivity) {
        public ScenarioResult { completedTasks = List.copyOf(completedTasks); }
    }
    record Result(String processKey, String sha256, List<ScenarioResult> scenarios) {
        public Result { scenarios = List.copyOf(scenarios); }
    }
}
