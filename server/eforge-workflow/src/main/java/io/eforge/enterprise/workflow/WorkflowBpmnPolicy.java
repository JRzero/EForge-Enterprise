package io.eforge.enterprise.workflow;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.xml.sax.InputSource;
import org.w3c.dom.*;
import org.xml.sax.helpers.DefaultHandler;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Package validation runs before any deployment or simulation. */
public final class WorkflowBpmnPolicy {
    private static final String BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL";
    private static final String FLOWABLE = "http://flowable.org/bpmn";
    private static final Map<String, Set<String>> ATTRIBUTES = Map.of(
        "definitions", Set.of("id", "targetNamespace"), "process", Set.of("id", "name", "isExecutable"),
        "startEvent", Set.of("id", "name"), "endEvent", Set.of("id", "name"),
        "userTask", Set.of("id", "name"), "exclusiveGateway", Set.of("id", "name", "default"),
        "sequenceFlow", Set.of("id", "name", "sourceRef", "targetRef"), "conditionExpression", Set.of(),
        "documentation", Set.of());
    private WorkflowBpmnPolicy() { }
    public record ValidatedProcess(String key, String xml, String sha256) { }
    public static ValidatedProcess validate(String xml) {
        try {
            if (xml == null || xml.length() > 262144) throw invalid();
            var factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new DefaultHandler());
            var document = builder.parse(new InputSource(new StringReader(xml)));
            inspect(document.getDocumentElement(), 0);
            if (!"definitions".equals(document.getDocumentElement().getLocalName())) throw invalid();
            var processes = document.getElementsByTagNameNS(BPMN, "process");
            if (processes.getLength() != 1) throw invalid();
            var process = (Element) processes.item(0);
            if (process.getParentNode() != document.getDocumentElement() || !"true".equals(process.getAttribute("isExecutable"))) throw invalid();
            validateGraph(process);
            return new ValidatedProcess(process.getAttribute("id"), xml,
                HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(xml.getBytes(StandardCharsets.UTF_8))));
        } catch (ApiFailure failure) { throw failure; }
        catch (Exception failure) { throw invalid(); }
    }

    private static void inspect(Element element, int depth) {
        String kind = element.getLocalName();
        if (depth > 8 || !BPMN.equals(element.getNamespaceURI()) || !ATTRIBUTES.containsKey(kind)) throw invalid();
        for (int i = 0; i < element.getAttributes().getLength(); i++) {
            var attribute = (Attr) element.getAttributes().item(i);
            String namespace = attribute.getNamespaceURI(), name = attribute.getLocalName(), value = attribute.getValue();
            if (XMLConstants.XMLNS_ATTRIBUTE_NS_URI.equals(namespace)) continue;
            if (FLOWABLE.equals(namespace) && kind.equals("userTask")) {
                boolean allowed = switch (name) {
                    case "assignee" -> value.equals("${approver}") || value.matches("[1-9][0-9]{0,18}");
                    case "candidateUsers" -> value.matches("[1-9][0-9]{0,18}(,[1-9][0-9]{0,18}){0,49}");
                    case "candidateGroups" -> value.matches("role:[1-9][0-9]{0,18}(,role:[1-9][0-9]{0,18}){0,49}");
                    default -> false;
                };
                if (!allowed) throw invalid();
                continue;
            }
            if (XMLConstants.W3C_XML_SCHEMA_INSTANCE_NS_URI.equals(namespace) && kind.equals("conditionExpression")
                && name.equals("type") && (value.equals("tFormalExpression") || value.equals("bpmn:tFormalExpression"))) continue;
            if (namespace != null || !ATTRIBUTES.get(kind).contains(name)) throw invalid();
            if (name.equals("id") && !value.matches("[A-Za-z][A-Za-z0-9_]{0,63}")) throw invalid();
            if (name.equals("name") && value.length() > 128) throw invalid();
        }
        if (kind.equals("userTask")) {
            long bindings = Set.of("assignee", "candidateUsers", "candidateGroups").stream()
                .filter(name -> element.hasAttributeNS(FLOWABLE, name)).count();
            if (bindings != 1) throw invalid();
        }
        if (kind.equals("conditionExpression") && !element.getTextContent().trim().matches("\\$\\{approved\\s*==\\s*(true|false)\\}")) throw invalid();
        for (Node child = element.getFirstChild(); child != null; child = child.getNextSibling()) {
            if (child instanceof Element nested) {
                boolean allowed = switch (kind) {
                    case "definitions" -> nested.getLocalName().equals("process");
                    case "process" -> Set.of("startEvent", "endEvent", "userTask", "exclusiveGateway", "sequenceFlow", "documentation").contains(nested.getLocalName());
                    case "sequenceFlow" -> nested.getLocalName().equals("conditionExpression");
                    default -> nested.getLocalName().equals("documentation") && !kind.equals("documentation") && !kind.equals("conditionExpression");
                };
                if (!allowed) throw invalid();
                inspect(nested, depth + 1);
            } else if (child.getNodeType() == Node.PROCESSING_INSTRUCTION_NODE) throw invalid();
            else if ((child.getNodeType() == Node.TEXT_NODE || child.getNodeType() == Node.CDATA_SECTION_NODE)
                && !Set.of("conditionExpression", "documentation").contains(kind) && !child.getTextContent().isBlank()) throw invalid();
        }
    }

    private static void validateGraph(Element process) {
        var nodes = new LinkedHashMap<String, Element>();
        var flows = new ArrayList<Element>();
        var ids = new HashSet<String>();
        ids.add(process.getAttribute("id"));
        for (Node child = process.getFirstChild(); child != null; child = child.getNextSibling()) {
            if (!(child instanceof Element element) || element.getLocalName().equals("documentation")) continue;
            String id = element.getAttribute("id");
            if (id.isEmpty() || !ids.add(id) || ids.size() > 201) throw invalid();
            if (element.getLocalName().equals("sequenceFlow")) flows.add(element); else nodes.put(id, element);
        }
        if (nodes.size() > 100 || !process.getAttribute("id").matches("[A-Za-z][A-Za-z0-9_]{0,63}")) throw invalid();
        var outgoing = new HashMap<String, List<Element>>();
        var incoming = new HashMap<String, Integer>();
        for (var flow : flows) {
            String from = flow.getAttribute("sourceRef"), to = flow.getAttribute("targetRef");
            if (!nodes.containsKey(from) || !nodes.containsKey(to)) throw invalid();
            outgoing.computeIfAbsent(from, ignored -> new ArrayList<>()).add(flow);
            incoming.merge(to, 1, Integer::sum);
            if (!nodes.get(from).getLocalName().equals("exclusiveGateway") && flow.getElementsByTagNameNS(BPMN, "conditionExpression").getLength() != 0) throw invalid();
        }
        String start = null;
        for (var entry : nodes.entrySet()) {
            String id = entry.getKey(), kind = entry.getValue().getLocalName();
            var edges = outgoing.getOrDefault(id, List.of());
            if (kind.equals("startEvent")) {
                if (start != null || incoming.containsKey(id)) throw invalid();
                start = id;
            } else if (!incoming.containsKey(id)) throw invalid();
            if (kind.equals("endEvent")) { if (!edges.isEmpty()) throw invalid(); }
            else if (kind.equals("exclusiveGateway")) {
                if (edges.size() != 2) throw invalid();
                var conditions = new HashSet<String>();
                for (var edge : edges) {
                    var expressions = edge.getElementsByTagNameNS(BPMN, "conditionExpression");
                    if (expressions.getLength() != 1) throw invalid();
                    conditions.add(expressions.item(0).getTextContent().replaceAll("\\s", ""));
                }
                if (!conditions.equals(Set.of("${approved==true}", "${approved==false}")) || entry.getValue().hasAttribute("default")) throw invalid();
            } else if (edges.size() != 1) throw invalid();
        }
        if (start == null) throw invalid();
        var visited = new HashSet<String>();
        visit(start, outgoing, new HashSet<>(), visited);
        if (visited.size() != nodes.size()) throw invalid();
        // Explore only paths that have not yet crossed a human task. No such path may terminate.
        var pending = new ArrayDeque<String>();
        var unchecked = new HashSet<String>();
        pending.add(start);
        while (!pending.isEmpty()) {
            String id = pending.removeFirst();
            if (!unchecked.add(id) || nodes.get(id).getLocalName().equals("userTask")) continue;
            if (nodes.get(id).getLocalName().equals("endEvent")) throw invalid();
            for (var edge : outgoing.getOrDefault(id, List.of())) pending.addLast(edge.getAttribute("targetRef"));
        }
    }

    private static void visit(String id, Map<String, List<Element>> edges, Set<String> active, Set<String> visited) {
        if (!active.add(id)) throw invalid();
        if (visited.add(id)) for (var edge : edges.getOrDefault(id, List.of())) visit(edge.getAttribute("targetRef"), edges, active, visited);
        active.remove(id);
    }
    private static ApiFailure invalid() { return new ApiFailure(400, "WORKFLOW_INVALID_BPMN", "流程包含不支持或不安全的 BPMN 配置。"); }
}
