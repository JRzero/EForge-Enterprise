package io.eforge.enterprise.generator.rendering;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.lang.model.SourceVersion;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Explicit target-language contexts. Never substitute one encoding for another. */
public final class GeneratorOutputText {
    /** Stateless fixed encoder exposed to the trusted template context. */
    public static final GeneratorOutputText INSTANCE = new GeneratorOutputText();
    private GeneratorOutputText() {}

    public static String javaLiteral(String value) {
        if(value==null)return "null";
        unicode(value);var out=new StringBuilder("\"");
        for(int index=0;index<value.length();index++) {
            char c=value.charAt(index);
            if(c=='\\')out.append("\\\\");
            else if(c=='\"')out.append("\\\"");
            else if(c<32||c==127)out.append('\\').append(String.format(java.util.Locale.ROOT,"%03o",(int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }

    /** A JSON string expression, also safe inside a JS/TS expression or HTML script. */
    public static String jsonLiteral(String value) {
        if(value==null)return "null";
        unicode(value);var out=new StringBuilder("\"");
        for(int index=0;index<value.length();index++) {
            char c=value.charAt(index);
            if(c=='\\')out.append("\\\\");
            else if(c=='"')out.append("\\\"");
            else if(c<32||c=='<'||c=='>'||c=='&'||c==0x2028||c==0x2029)
                out.append(String.format(java.util.Locale.ROOT,"\\u%04x",(int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }

    /** Exact text independent of MySQL backslash/ANSI quoting modes or connection charset. */
    public static String mysqlLiteral(String value) {
        if(value==null)return "NULL";
        unicode(value);
        return "CONVERT(X'"+HexFormat.of().formatHex(value.getBytes(StandardCharsets.UTF_8))+"' USING utf8mb4)";
    }

    /** One identifier segment, never a dotted expression or a raw SQL fragment. */
    public static String mysqlIdentifier(String value) {
        if(value==null||value.isEmpty()||value.length()>64)throw invalid();
        unicode(value);
        for(int index=0;index<value.length();index++) {
            char c=value.charAt(index);
            // MySQL identifiers cannot contain NUL, supplementary characters or U+FFFF.
            if(c==0||c==0xffff||Character.isSurrogate(c))throw invalid();
        }
        return "`"+value.replace("`","``")+"`";
    }

    public static String javaIdentifier(String value) {
        if(value==null||!SourceVersion.isIdentifier(value)||SourceVersion.isKeyword(value,SourceVersion.RELEASE_17)
            )throw invalid();
        unicode(value);return value;
    }

    /** XML 1.0 attribute/text encoding. Values outside XML's character repertoire fail. */
    public static String xml(String value) {
        if(value==null)return "";
        unicode(value);var out=new StringBuilder();
        value.codePoints().forEach(c->{
            if(!(c==9||c==10||c==13||c>=32&&c<=0xd7ff||c>=0xe000&&c<=0xfffd||c>=0x10000&&c<=0x10ffff))throw invalid();
            switch(c) {
                case '&' -> out.append("&amp;"); case '<' -> out.append("&lt;"); case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;"); case '\'' -> out.append("&apos;");
                // Character references preserve attribute whitespace through XML normalization.
                case 9 -> out.append("&#9;");case 10 -> out.append("&#10;");case 13 -> out.append("&#13;");
                default -> out.appendCodePoint(c);
            }
        });return out.toString();
    }

    /** A Java comment body; neutralizes comment termination and Unicode prelexing. */
    public static String javaComment(String value) {
        if(value==null)return "";
        unicode(value);
        return value.replace("&","&amp;").replace("\\","&#92;").replace("<","&lt;")
            .replace(">","&gt;").replace("*/","*&#47;").replace("\r","&#13;").replace("\n","&#10;");
    }

    /** Quoted SpEL string expression. Wrap with javaLiteral when embedded in Java. */
    public static String spelLiteral(String value) {
        if(value==null)return "null";
        unicode(value);return "'"+value.replace("'","''")+"'";
    }

    private static void unicode(String value) {
        for(int index=0;index<value.length();index++) {
            char c=value.charAt(index);
            if(Character.isHighSurrogate(c)) {
                if(++index>=value.length()||!Character.isLowSurrogate(value.charAt(index)))throw invalid();
            } else if(Character.isLowSurrogate(c))throw invalid();
        }
    }
    private static ApiFailure invalid() {
        return new ApiFailure(400,"GENERATOR_OUTPUT_TEXT_INVALID","Generator metadata cannot be represented in the selected output context.");
    }
}