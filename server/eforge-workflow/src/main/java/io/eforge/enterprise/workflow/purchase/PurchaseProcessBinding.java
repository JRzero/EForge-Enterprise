package io.eforge.enterprise.workflow.purchase;

import java.util.Set;
import java.util.stream.Collectors;
import org.flowable.engine.ProcessEngine;
import org.flowable.bpmn.model.UserTask;
import org.flowable.bpmn.model.EndEvent;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowValidation;

/** Only the purchase business may supply the approved dynamic assignee variable. */
public final class PurchaseProcessBinding {
    private PurchaseProcessBinding() { }
    public static void requireProof(WorkflowValidation.Request request){
        boolean approved=false,rejected=false;
        for(var scenario:request.scenarios()){
            if(scenario.decisions().size()!=1)throw invalid();
            boolean decision=scenario.decisions().get(0).approved();
            if(decision&&"approvedEnd".equals(scenario.expectedEnd()))approved=true;
            else if(!decision&&"rejectedEnd".equals(scenario.expectedEnd()))rejected=true;
            else throw invalid();
        }
        if(!approved||!rejected)throw invalid();
    }
    public static void require(ProcessEngine engine,String definition){
        var process=engine.getRepositoryService().getBpmnModel(definition).getMainProcess();
        var tasks=process.findFlowElementsOfType(UserTask.class);
        var ends=process.findFlowElementsOfType(EndEvent.class).stream().map(EndEvent::getId).collect(Collectors.toSet());
        if(tasks.size()!=1||!ends.equals(Set.of("approvedEnd","rejectedEnd")))throw invalid();
        var task=tasks.get(0);
        if(!"${approver}".equals(task.getAssignee())||!task.getCandidateUsers().isEmpty()||!task.getCandidateGroups().isEmpty()||task.isAsynchronous())throw invalid();
    }
    private static ApiFailure invalid(){return new ApiFailure(409,"PURCHASE_BINDING_INVALID","采购流程必须采用单级同步指定审批人。");}
}
