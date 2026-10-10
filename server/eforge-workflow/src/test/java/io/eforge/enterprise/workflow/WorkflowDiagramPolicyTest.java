package io.eforge.enterprise.workflow;

import org.junit.jupiter.api.Test;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.assertj.core.api.Assertions.*;

class WorkflowDiagramPolicyTest {
    static final String DI="""
        <bpmndi:BPMNDiagram id="Diagram_1" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI">
          <bpmndi:BPMNPlane id="Plane_1" bpmnElement="leaveApproval">
            <bpmndi:BPMNShape id="Shape_start" bpmnElement="start"><dc:Bounds x="50" y="50" width="36" height="36"/></bpmndi:BPMNShape>
            <bpmndi:BPMNShape id="Shape_review" bpmnElement="review"><dc:Bounds x="150" y="30" width="100" height="80"/><bpmndi:BPMNLabel><dc:Bounds x="150" y="115" width="100" height="20"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
            <bpmndi:BPMNShape id="Shape_end" bpmnElement="end"><dc:Bounds x="300" y="50" width="36" height="36"/></bpmndi:BPMNShape>
            <bpmndi:BPMNEdge id="Edge_a" bpmnElement="a"><di:waypoint x="86" y="68"/><di:waypoint x="150" y="68"/></bpmndi:BPMNEdge>
            <bpmndi:BPMNEdge id="Edge_b" bpmnElement="b"><di:waypoint x="250" y="68"/><di:waypoint x="300" y="68"/></bpmndi:BPMNEdge>
          </bpmndi:BPMNPlane>
        </bpmndi:BPMNDiagram>
        """;
    static String xml(){return WorkflowBpmnPolicyTest.XML.replace("</definitions>",DI+"</definitions>")
        .replace("<startEvent id=\"start\"/>","<startEvent id=\"start\"><outgoing>a</outgoing></startEvent>");}
    @Test void retainsDiagramAndConsistentModelerReferences(){
        assertThat(WorkflowBpmnPolicy.validate(xml()).xml()).isEqualTo(xml());
    }
    @Test void refusesUnsafeCoordinatesReferencesAndExtensions(){
        for(String bad:new String[]{xml().replace("x=\"50\"","x=\"NaN\""),xml().replace("width=\"36\"","width=\"-1\""),
            xml().replace("x=\"50\"","x=\"100000000\""),xml().replace("bpmnElement=\"a\"","bpmnElement=\"review\""),
            xml().replace("Shape_start","review"),xml().replace("<outgoing>a</outgoing>","<outgoing>b</outgoing>"),
            xml().replace("<outgoing>a</outgoing>","<outgoing>a</outgoing><outgoing>a</outgoing>"),
            xml().replace("<dc:Bounds x=\"50\"","<dc:Bounds href=\"https://example.invalid\" x=\"50\""),
            xml().replace("<bpmndi:BPMNPlane", "<script xmlns=\"http://www.w3.org/1999/xhtml\">alert(1)</script><bpmndi:BPMNPlane")})
            assertThatThrownBy(()->WorkflowBpmnPolicy.validate(bad)).isInstanceOf(ApiFailure.class);
    }
}
