package io.eforge.enterprise.generator.rendering;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.apache.velocity.app.Velocity;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.util.*;

/** Complete detached output. No mapper, transaction or filesystem access. */
public final class GeneratorRenderedBundle {
    public record File(String template, String path, String content) {}
    private static final int MAX_FILE_CHARS = 4 * 1024 * 1024;
    private static final long MAX_TOTAL_BYTES = 32L * 1024 * 1024;
    private final List<File> files;
    private GeneratorRenderedBundle(List<File> files) { this.files = List.copyOf(files); }
    public List<File> files() { return files; }

    public static GeneratorRenderedBundle render(GeneratorRenderingSnapshot snapshot) {
        Objects.requireNonNull(snapshot);
        VelocityInitializer.initVelocity();
        var entries = new ArrayList<File>();
        var templates = VelocityUtils.getTemplateList(snapshot.legacyWorkingTable());
        var paths = new LinkedHashMap<String,String>();
        var namingTable = snapshot.legacyWorkingTable();
        // Preserve association validation before filenames dereference the child.
        VelocityUtils.prepareContext(namingTable);
        for (String template : templates) paths.put(template, safePath(VelocityUtils.getFileName(template, namingTable)));
        for (String template : templates) {
            var table = snapshot.legacyWorkingTable();
            String path = paths.get(template);
            var context = VelocityUtils.prepareContext(table);
            context.put("datetime", snapshot.generationDate());
            var writer = new LimitedWriter();
            Velocity.getTemplate(template, "UTF-8").merge(context, writer);
            entries.add(new File(template, path, writer.toString()));
        }
        return combine(List.of(new GeneratorRenderedBundle(entries)));
    }

    /** Preserve the original shared TypeScript export index, reject other collisions. */
    public static GeneratorRenderedBundle combine(Iterable<GeneratorRenderedBundle> bundles) {
        var output = new LinkedHashMap<String,File>();
        long bytes = 0;
        for (var bundle : bundles) for (var file : bundle.files) {
            String path = safePath(file.path());
            String previousPath = output.keySet().stream().filter(key -> key.equalsIgnoreCase(path)).findFirst().orElse(null);
            File next = file;
            if (previousPath != null) {
                File previous = output.get(previousPath);
                if (!previousPath.equals(path) || !file.template().equals("vm/ts/index.ts.vm") || !previous.template().equals(file.template()))
                    throw new ApiFailure(409,"GENERATOR_OUTPUT_COLLISION","Generated files have conflicting output paths.");
                StringBuilder exports = new StringBuilder(previous.content());
                file.content().lines().filter(line -> line.startsWith("export * from")).forEach(line -> exports.append('\n').append(line));
                next = new File(file.template(), path, exports.toString());
                bytes -= previous.content().getBytes(StandardCharsets.UTF_8).length;
            }
            bytes += next.content().getBytes(StandardCharsets.UTF_8).length;
            if (bytes > MAX_TOTAL_BYTES) throw tooLarge();
            output.put(path, next);
        }
        return new GeneratorRenderedBundle(new ArrayList<>(output.values()));
    }

    /** Compatibility projection: original preview keys remain template resource names. */
    public Map<String,String> legacyPreview() {
        var result = new LinkedHashMap<String,String>();
        for (var file : files) result.put(file.template(),file.content());
        return Collections.unmodifiableMap(result);
    }

    /** Finish the entire archive before the caller receives any bytes. */
    public byte[] zip() {
        var bytes = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (var file : files) {
                var entry = new ZipEntry(file.path()); entry.setTime(0);
                zip.putNextEntry(entry); zip.write(file.content().getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
            }
        } catch (IOException failure) {
            throw new ApiFailure(500,"GENERATOR_ARCHIVE_UNAVAILABLE","Generated files cannot be archived safely.");
        }
        return bytes.toByteArray();
    }

    private static String safePath(String path) {
        if (path == null || path.isEmpty() || path.getBytes(StandardCharsets.UTF_8).length > 4096) throw invalidPath();
        for (String part : path.split("/",-1)) {
            if (part.isEmpty() || part.equals(".") || part.equals("..") || part.endsWith(".") || part.endsWith(" ") || part.length()>255) throw invalidPath();
            String stem = part.split("\\.",2)[0];
            if (stem.matches("(?i)(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])")) throw invalidPath();
            for (int i=0;i<part.length();i++) {
                char ch=part.charAt(i);
                if (ch<32 || ch==127 || "\\:<>\"|?*".indexOf(ch)>=0) throw invalidPath();
                if (Character.isHighSurrogate(ch)) { if (++i>=part.length() || !Character.isLowSurrogate(part.charAt(i))) throw invalidPath(); }
                else if (Character.isLowSurrogate(ch)) throw invalidPath();
            }
        }
        return path;
    }
    private static ApiFailure invalidPath() { return new ApiFailure(400,"GENERATOR_OUTPUT_PATH_INVALID","Generated output paths must be safe relative file names."); }
    private static ApiFailure tooLarge() { return new ApiFailure(413,"GENERATOR_OUTPUT_TOO_LARGE","Generated output exceeds the supported size."); }
    private static final class LimitedWriter extends Writer {
        private final StringBuilder text = new StringBuilder();
        @Override public void write(char[] chars,int offset,int length) {
            if ((long)text.length()+length > MAX_FILE_CHARS) throw tooLarge();
            text.append(chars,offset,length);
        }
        @Override public void flush() {}
        @Override public void close() {}
        @Override public String toString() { return text.toString(); }
    }
}