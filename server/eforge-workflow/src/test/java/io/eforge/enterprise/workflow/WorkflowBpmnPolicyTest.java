package io.eforge.enterprise.workflow;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.assertj.core.api.Assertions.*;

class WorkflowBpmnPolicyTest {
    static final String XML = """
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:flowable="http://flowable.org/bpmn" targetNamespace="https://eforge.io/workflow">
          <process id="leaveApproval" name="请假审批" isExecutable="true">
            <startEvent id="start"/><sequenceFlow id="a" sourceRef="start" targetRef="review"/>
            <userTask id="review" name="经理审批" flowable:candidateGroups="role:2"/>
            <sequenceFlow id="b" sourceRef="review" targetRef="end"/><endEvent id="end"/>
          </process>
        </definitions>
        """;

    @Test void acceptsHumanApprovalAndRetainsExactSource() {
        var process = WorkflowBpmnPolicy.validate(XML);
        assertThat(process.key()).isEqualTo("leaveApproval");
        assertThat(process.xml()).isEqualTo(XML);
        assertThat(process.sha256()).hasSize(64);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "<serviceTask id='review' flowable:class='java.lang.Runtime'/>",
        "<scriptTask id='review' scriptFormat='groovy'><script>throw new RuntimeException()</script></scriptTask>",
        "<userTask id='review' flowable:assignee='${evil.run()}'/>",
        "<userTask id='review' flowable:candidateGroups='${roles}'/>",
        "<userTask id='review'><extensionElements><flowable:taskListener event='create' class='java.lang.Runtime'/></extensionElements></userTask>",
        "<callActivity id='review' calledElement='other'/>",
        "<userTask id='review' flowable:async='true'/>",
        "<userTask id='review' flowable:candidateGroups='role:2' flowable:skipExpression='${true}'/>",
        "<userTask id='review'/>"
    })
    void rejectsExecutableExtensionsAndMissingOwnership(String task) {
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate(XML.replace(
            "<userTask id=\"review\" name=\"经理审批\" flowable:candidateGroups=\"role:2\"/>", task)))
            .isInstanceOf(ApiFailure.class).hasMessage("流程包含不支持或不安全的 BPMN 配置。");
    }

    @Test void rejectsDoctypeWithoutReadingExternalResources() {
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate("<!DOCTYPE definitions [<!ENTITY x SYSTEM 'file:///never-read'>]>" + XML))
            .isInstanceOf(ApiFailure.class);
    }

    @Test void rejectsDisconnectedAndCyclicGraph() {
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate(XML.replace("<endEvent id=\"end\"/>",
            "<endEvent id=\"end\"/><endEvent id=\"orphan\"/>"))).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate(XML.replace("targetRef=\"end\"", "targetRef=\"review\"")))
            .isInstanceOf(ApiFailure.class);
    }

    @Test void rejectsAutomaticApprovalAndBranchesBypassingPeople() {
        String automatic = XML.replace("targetRef=\"review\"", "targetRef=\"end\"")
            .replace("<userTask id=\"review\" name=\"经理审批\" flowable:candidateGroups=\"role:2\"/>", "")
            .replace("<sequenceFlow id=\"b\" sourceRef=\"review\" targetRef=\"end\"/>", "");
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate(automatic)).isInstanceOf(ApiFailure.class);
        String bypass = XML.replace("targetRef=\"review\"", "targetRef=\"branch\"").replace("<userTask", """
            <exclusiveGateway id="branch"/>
            <sequenceFlow id="yes" sourceRef="branch" targetRef="end"><conditionExpression>${approved == true}</conditionExpression></sequenceFlow>
            <sequenceFlow id="no" sourceRef="branch" targetRef="review"><conditionExpression>${approved == false}</conditionExpression></sequenceFlow>
            <userTask""");
        assertThatThrownBy(() -> WorkflowBpmnPolicy.validate(bypass)).isInstanceOf(ApiFailure.class);
    }
}
