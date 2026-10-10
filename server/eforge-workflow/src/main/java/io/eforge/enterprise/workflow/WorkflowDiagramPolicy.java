package io.eforge.enterprise.workflow;

import java.util.*;
import org.w3c.dom.*;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Inert BPMN DI only; every element, attribute, number and reference is checked. */
final class WorkflowDiagramPolicy {
    private static final String B="http://www.omg.org/spec/BPMN/20100524/MODEL", D="http://www.omg.org/spec/BPMN/20100524/DI",
        C="http://www.omg.org/spec/DD/20100524/DC", W="http://www.omg.org/spec/DD/20100524/DI";
    static void validate(Document doc,Element process){
        var ids=new HashSet<String>();var objects=new HashMap<String,Element>();
        var all=doc.getElementsByTagName("*");
        if(all.getLength()>2500)throw invalid();
        for(int i=0;i<all.getLength();i++){
            var e=(Element)all.item(i);String id=e.getAttribute("id");
            if(e.hasAttribute("id")&&(!id.matches("[A-Za-z][A-Za-z0-9_]{0,63}")||!ids.add(id)))throw invalid();
            if(B.equals(e.getNamespaceURI())&&!id.isEmpty())objects.put(id,e);
        }
        for(var e:objects.values()){
            var seen=new HashSet<String>();
            for(var ref:children(e))if(Set.of("incoming","outgoing").contains(ref.getLocalName())){
                var flow=objects.get(ref.getTextContent());
                if(flow==null||!flow.getLocalName().equals("sequenceFlow")||!e.getAttribute("id").equals(flow.getAttribute(ref.getLocalName().equals("incoming")?"targetRef":"sourceRef"))
                    ||!seen.add(ref.getLocalName()+":"+ref.getTextContent()))throw invalid();
            }
        }
        var diagrams=doc.getElementsByTagNameNS(D,"BPMNDiagram");if(diagrams.getLength()>1)throw invalid();
        if(diagrams.getLength()==0)return;
        var diagram=(Element)diagrams.item(0);attrs(diagram,Set.of("id"));var planes=children(diagram);
        if(planes.size()!=1)throw invalid();var plane=planes.get(0);kind(plane,D,"BPMNPlane");attrs(plane,Set.of("id","bpmnElement"));
        if(!plane.getAttribute("bpmnElement").equals(process.getAttribute("id")))throw invalid();
        var drawn=new HashSet<String>();
        for(var item:children(plane)){
            boolean shape=item.getLocalName().equals("BPMNShape");kind(item,D,shape?"BPMNShape":"BPMNEdge");
            attrs(item,shape?Set.of("id","bpmnElement","isMarkerVisible"):Set.of("id","bpmnElement"));
            if(item.hasAttribute("isMarkerVisible")&&!Set.of("true","false").contains(item.getAttribute("isMarkerVisible")))throw invalid();
            String ref=item.getAttribute("bpmnElement");var target=objects.get(ref);
            if(target==null||target.getParentNode()!=process||!drawn.add(ref)||shape==target.getLocalName().equals("sequenceFlow"))throw invalid();
            int bounds=0,points=0,labels=0;
            for(var part:children(item)){
                if(C.equals(part.getNamespaceURI())&&part.getLocalName().equals("Bounds")&&shape){bounds++;bounds(part);}
                else if(W.equals(part.getNamespaceURI())&&part.getLocalName().equals("waypoint")&&!shape){points++;attrs(part,Set.of("x","y"));number(part,"x",false);number(part,"y",false);if(!children(part).isEmpty())throw invalid();}
                else {kind(part,D,"BPMNLabel");attrs(part,Set.of("id"));labels++;var box=children(part);if(box.size()>1)throw invalid();if(!box.isEmpty())bounds(box.get(0));}
            }
            if(labels>1||shape&&bounds!=1||!shape&&(points<2||points>200))throw invalid();
        }
    }
    private static void bounds(Element e){kind(e,C,"Bounds");attrs(e,Set.of("x","y","width","height"));for(String p:List.of("x","y","width","height"))number(e,p,p.equals("width")||p.equals("height"));if(!children(e).isEmpty())throw invalid();}
    private static void number(Element e,String p,boolean positive){
        try{double n=Double.parseDouble(e.getAttribute(p));if(!Double.isFinite(n)||Math.abs(n)>100000||positive&&n<=0)throw invalid();}catch(NumberFormatException bad){throw invalid();}
    }
    private static void kind(Element e,String namespace,String local){if(!namespace.equals(e.getNamespaceURI())||!local.equals(e.getLocalName()))throw invalid();}
    private static void attrs(Element e,Set<String> allowed){
        for(int i=0;i<e.getAttributes().getLength();i++){var a=(Attr)e.getAttributes().item(i);if("http://www.w3.org/2000/xmlns/".equals(a.getNamespaceURI()))continue;if(a.getNamespaceURI()!=null||!allowed.contains(a.getName()))throw invalid();}
    }
    private static List<Element> children(Element e){
        var result=new ArrayList<Element>();for(Node n=e.getFirstChild();n!=null;n=n.getNextSibling()){
            if(n instanceof Element child)result.add(child);
            else if(n.getNodeType()==Node.PROCESSING_INSTRUCTION_NODE||n.getNodeType()!=Node.COMMENT_NODE&&!n.getTextContent().isBlank())throw invalid();
        }return result;
    }
    private static ApiFailure invalid(){return new ApiFailure(400,"WORKFLOW_INVALID_BPMN","流程包含不支持或不安全的 BPMN 配置。");}
}
