package io.eforge.enterprise.web.controller.api.v1.system;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.SAXParserFactory;
import javax.xml.transform.*;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.*;
import org.xml.sax.*;
import org.xml.sax.helpers.DefaultHandler;
import io.eforge.enterprise.common.config.RuoYiConfig;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Notice-local image boundary: decoded rasters or reconstructed, inert SVG. */
@Component
public class NoticeImageStore
{
    private static final String SVG = "http://www.w3.org/2000/svg";
    private static final String PREFIX = "/profile/upload/notices/";
    private static final Set<String> TAGS = Set.of("svg", "g", "defs", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern");
    private static final Set<String> GEOMETRY = Set.of("x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "dx", "dy", "width", "height", "viewBox", "d", "points", "transform", "gradientTransform", "patternTransform", "offset", "pathLength", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit", "font-size", "letter-spacing", "word-spacing", "opacity", "fill-opacity", "stroke-opacity", "stop-opacity");
    private static final Set<String> WORDS = Set.of("fill-rule", "clip-rule", "stroke-linecap", "stroke-linejoin", "text-anchor", "dominant-baseline", "font-family", "font-weight", "font-style", "preserveAspectRatio", "gradientUnits", "spreadMethod", "clipPathUnits", "maskUnits", "maskContentUnits", "patternUnits", "patternContentUnits", "vector-effect");
    private static final Set<String> PAINT = Set.of("fill", "stroke", "color", "stop-color");
    private static final Set<String> REFERENCE = Set.of("clip-path", "mask");

    public record StoredImage(String imageUrl) {}

    public StoredImage upload(MultipartFile file)
    {
        String name = Objects.toString(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() >= 5L * 1024 * 1024 || !name.matches(".*\\.(png|jpe?g|svg)$")) throw invalid();
        byte[] normalized;
        String extension;
        try (var input = file.getInputStream())
        {
            byte[] bytes = input.readNBytes(5 * 1024 * 1024);
            if (bytes.length == 0 || bytes.length >= 5 * 1024 * 1024) throw invalid();
            if (name.endsWith(".svg")) {normalized = svg(bytes); extension = ".svg";}
            else {normalized = raster(bytes); extension = ".png";}
        }
        catch (ApiFailure exception) {throw exception;}
        catch (Exception exception) {throw invalid();}
        Path directory = Path.of(RuoYiConfig.getUploadPath()).toAbsolutePath().normalize().resolve("notices");
        String filename = UUID.randomUUID() + extension;
        Path target = directory.resolve(filename);
        try
        {
            Files.createDirectories(directory);
            Files.write(target, normalized, StandardOpenOption.CREATE_NEW);
            return new StoredImage(PREFIX + filename);
        }
        catch (IOException exception)
        {
            try {Files.deleteIfExists(target);} catch (IOException cleanup) { /* Owned partial output only. */ }
            throw new ApiFailure(503, "NOTICE_IMAGE_STORAGE_UNAVAILABLE", "The notice image could not be stored.");
        }
    }

    private byte[] raster(byte[] bytes) throws IOException
    {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes)))
        {
            if (input == null) throw invalid();
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try
            {
                if (!Set.of("png", "jpeg", "jpg").contains(reader.getFormatName().toLowerCase(Locale.ROOT))) throw invalid();
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 16_000_000) throw invalid();
                BufferedImage image = reader.read(0);
                if (image == null) throw invalid();
                var output = new ByteArrayOutputStream();
                if (!ImageIO.write(image, "png", output)) throw invalid();
                return output.toByteArray();
            }
            finally {reader.dispose();}
        }
    }

    private byte[] svg(byte[] bytes) throws Exception
    {
        // Bound nodes/depth before allocating a DOM, not after it is built.
        var sax = SAXParserFactory.newInstance(); sax.setNamespaceAware(true); sax.setXIncludeAware(false);
        sax.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        sax.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        sax.setFeature("http://xml.org/sax/features/external-general-entities", false);
        sax.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        var reader = sax.newSAXParser().getXMLReader();
        reader.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, ""); reader.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        var limits = new DefaultHandler() {
            int depth, nodes;
            @Override public void startElement(String uri, String local, String qualified, Attributes attributes)
            {
                if (++depth > 64 || ++nodes > 10_000 || attributes.getLength() > 64) throw invalid();
                for (int index = 0; index < attributes.getLength(); index++) {
                    String name = attributes.getLocalName(index);
                    if (("class".equals(name) || "style".equals(name)) && attributes.getValue(index).length() > 4096) throw invalid();
                }
            }
            @Override public void endElement(String uri, String local, String qualified) {depth--;}
            @Override public void error(SAXParseException error) throws SAXException {throw error;}
            @Override public void fatalError(SAXParseException error) throws SAXException {throw error;}
        };
        reader.setContentHandler(limits); reader.setErrorHandler(limits);
        reader.setEntityResolver((publicId, systemId) -> {throw new SAXException("External resources are forbidden.");});
        reader.parse(new InputSource(new ByteArrayInputStream(bytes)));
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true); factory.setXIncludeAware(false); factory.setExpandEntityReferences(false);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        var builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> {throw new SAXException("External resources are forbidden.");});
        builder.setErrorHandler(new ErrorHandler() {
            public void warning(SAXParseException error) throws SAXException {throw error;}
            public void error(SAXParseException error) throws SAXException {throw error;}
            public void fatalError(SAXParseException error) throws SAXException {throw error;}
        });
        var source = builder.parse(new ByteArrayInputStream(bytes));
        if (!SVG.equals(source.getDocumentElement().getNamespaceURI()) || !"svg".equals(source.getDocumentElement().getLocalName())) throw invalid();
        var document = builder.newDocument();
        var root = copy(source.getDocumentElement(), document, 0, new int[]{0}, styles(source));
        if (root == null) throw invalid();
        document.appendChild(root);
        validateReferences(root);
        var transforms = TransformerFactory.newInstance();
        transforms.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        transforms.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); transforms.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
        var transform = transforms.newTransformer();
        transform.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes"); transform.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        var output = new ByteArrayOutputStream(); transform.transform(new DOMSource(document), new StreamResult(output));
        return output.toByteArray();
    }

    private record StyleRule(String selector, Map<String, String> declarations, int priority) {
        boolean matches(Element element, Set<String> classes) {
            if (selector.startsWith("#")) return element.getAttribute("id").equals(selector.substring(1));
            if (selector.startsWith(".")) return classes.contains(selector.substring(1));
            return selector.equals(element.getLocalName());
        }
    }
    private List<StyleRule> styles(Document source)
    {
        List<StyleRule> rules = new ArrayList<>();
        var elements = source.getElementsByTagNameNS(SVG, "style");
        for (int index = 0; index < elements.getLength(); index++)
        {
            String raw = elements.item(index).getTextContent();
            if (raw.length() > 1_048_576) throw invalid();
            String text = withoutComments(raw);
            int cursor = 0;
            while (cursor < text.length())
            {
                int open = text.indexOf('{', cursor);
                if (open < 0) break;
                int close = text.indexOf('}', open + 1);
                if (close < 0) break;
                if (open - cursor > 4096 || close - open - 1 > 4096) throw invalid();
                var body = declarations(text.substring(open + 1, close));
                for (String selector : text.substring(cursor, open).split(",")) {
                    selector = selector.trim();
                    if (selector.matches("[.#][A-Za-z_][A-Za-z0-9_-]{0,127}") || TAGS.contains(selector)) {
                        if (rules.size() >= 256) throw invalid();
                        rules.add(new StyleRule(selector, body, selector.startsWith("#") ? 100 : selector.startsWith(".") ? 10 : 1));
                    }
                }
                cursor = close + 1;
            }
        }
        rules.sort(Comparator.comparingInt(StyleRule::priority));
        return rules;
    }
    private String withoutComments(String value)
    {
        StringBuilder output = new StringBuilder();
        int cursor = 0;
        while (cursor < value.length()) {
            int start = value.indexOf("/*", cursor);
            if (start < 0) {output.append(value, cursor, value.length()); break;}
            output.append(value, cursor, start);
            int end = value.indexOf("*/", start + 2);
            if (end < 0) break;
            cursor = end + 2;
        }
        return output.toString();
    }
    private Map<String, String> declarations(String value)
    {
        if (value.length() > 4096) throw invalid();
        Map<String, String> output = new LinkedHashMap<>();
        for (String declaration : value.split(";")) {
            var parts = declaration.split(":", 2);
            if (parts.length == 2) {if (output.size() >= 64) throw invalid(); output.put(parts[0].trim(), parts[1].trim().replaceFirst("(?i)\\s*!important$", ""));}
        }
        return output;
    }
    private Element copy(Element source, Document target, int depth, int[] count, List<StyleRule> styles)
    {
        if (depth > 64 || ++count[0] > 10_000) throw invalid();
        if (!SVG.equals(source.getNamespaceURI()) || !TAGS.contains(source.getLocalName())) return null;
        Element result = target.createElementNS(SVG, source.getLocalName());
        var attributes = source.getAttributes();
        for (int i = 0; i < attributes.getLength(); i++)
        {
            var attribute = attributes.item(i);
            String namespace = attribute.getNamespaceURI(), name = attribute.getLocalName(), value = attribute.getNodeValue().trim();
            if ("http://www.w3.org/1999/xlink".equals(namespace) && "href".equals(name)) name = "href";
            else if (namespace != null) continue;
            if (!"style".equals(name)) attribute(result, name, value);
        }
        Set<String> classes = new HashSet<>(Arrays.asList(source.getAttribute("class").split("\\s+")));
        for (var rule : styles) if (rule.matches(source, classes)) rule.declarations().forEach((name, value) -> attribute(result, name, value));
        declarations(source.getAttribute("style")).forEach((name, value) -> attribute(result, name, value));
        for (Node child = source.getFirstChild(); child != null; child = child.getNextSibling())
        {
            if (child instanceof Element element) {var copied = copy(element, target, depth + 1, count, styles); if (copied != null) result.appendChild(copied);}
            else if (child.getNodeType() == Node.TEXT_NODE || child.getNodeType() == Node.CDATA_SECTION_NODE) result.appendChild(target.createTextNode(child.getNodeValue()));
        }
        return result;
    }

    private void attribute(Element element, String name, String value)
    {
        if (name == null || value.length() > 1_000_000) return;
        boolean safe = "id".equals(name) && value.matches("[A-Za-z_][A-Za-z0-9_.-]{0,127}")
                || "href".equals(name) && value.matches("#[A-Za-z_][A-Za-z0-9_.-]{0,127}")
                || GEOMETRY.contains(name) && value.matches("[-+0-9.eE\\s,%A-Za-z()]*")
                || WORDS.contains(name) && value.matches("[\\p{L}\\p{N}\\s,'\"-]*")
                || PAINT.contains(name) && (value.matches("(?:[A-Za-z]+|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\\([0-9.%,\\s+-]+\\))") || localUrl(value))
                || REFERENCE.contains(name) && ("none".equals(value) || localUrl(value));
        if (safe) element.setAttribute(name, value);
    }

    private boolean localUrl(String value) {return value.matches("url\\(#[A-Za-z_][A-Za-z0-9_.-]{0,127}\\)");}

    private void validateReferences(Element root)
    {
        Map<String, Element> ids = new HashMap<>();
        List<Element> elements = new ArrayList<>(); collect(root, elements);
        for (var element : elements) if (element.hasAttribute("id") && ids.put(element.getAttribute("id"), element) != null) throw invalid();
        // Prevent cyclic/internal-use expansion as well as external references.
        expanded(root, ids, new HashSet<>(), new int[]{0});
    }
    private void collect(Element element, List<Element> output)
    {output.add(element); for (Node child = element.getFirstChild(); child != null; child = child.getNextSibling()) if (child instanceof Element nested) collect(nested, output);}
    private void expanded(Element element, Map<String, Element> ids, Set<Element> visiting, int[] work)
    {
        if (++work[0] > 10_000 || visiting.size() > 64 || !visiting.add(element)) throw invalid();
        for (String name : List.of("href", "fill", "stroke", "clip-path", "mask"))
        {
            String value = element.getAttribute(name), id = value.startsWith("#") && name.equals("href") ? value.substring(1) : localUrl(value) ? value.substring(5, value.length()-1) : null;
            if (id != null && ids.containsKey(id)) expanded(ids.get(id), ids, visiting, work);
        }
        for (Node child = element.getFirstChild(); child != null; child = child.getNextSibling()) if (child instanceof Element nested) expanded(nested, ids, visiting, work);
        visiting.remove(element);
    }
    private static ApiFailure invalid()
    {return new ApiFailure(400, "NOTICE_IMAGE_INVALID", "Upload a valid JPG, PNG or static SVG image smaller than 5 MB.");}
}
