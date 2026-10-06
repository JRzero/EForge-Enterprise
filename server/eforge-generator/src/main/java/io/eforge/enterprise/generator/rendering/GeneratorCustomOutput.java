package io.eforge.enterprise.generator.rendering;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.config.GenConfig;

/** Writes only completed backend output into an administrator-controlled root. */
@Service
public class GeneratorCustomOutput {
    public enum State { CREATED, REPLACED, FAILED, UNCONFIRMED, UNATTEMPTED }
    public record CustomOutputOutcome(String path, State state) {}
    public record CustomOutputResult(List<CustomOutputOutcome> files) { public CustomOutputResult {files=List.copyOf(files);} }
    public static final class Failure extends RuntimeException {
        private final CustomOutputResult result;
        public Failure(CustomOutputResult result){super("Custom output did not complete. Review the retained file outcomes.");this.result=result;}
        public CustomOutputResult result(){return result;}
    }
    private final Path root;
    public GeneratorCustomOutput(@Value("${gen.outputRoot:${outputRoot:${user.dir}/src}}") String root){
        this.root=Path.of(root).toAbsolutePath().normalize();
    }
    public void requireEnabled(){
        if(!GenConfig.isAllowOverwrite())throw new ApiFailure(403,"GENERATOR_CUSTOM_OUTPUT_DISABLED","Custom file output is disabled by server configuration.");
    }
    /** Serializes this bean's writes, never metadata reads or scheduler execution. */
    public synchronized CustomOutputResult write(GeneratorRenderingSnapshot snapshot) {
        requireEnabled();
        var bundle=GeneratorRenderedBundle.render(snapshot);
        String configured=snapshot.legacyWorkingTable().getGenPath();
        Path destination=destination(configured);
        var files=bundle.files().stream().filter(f->f.template().startsWith("vm/java/")||f.template().startsWith("vm/xml/")).toList();
        var paths=new ArrayList<Path>();
        try {
            inspect(root); Files.createDirectories(root); inspect(root);
            for(var file:files){
                Path target=destination.resolve(file.path()).normalize();
                if(!target.startsWith(root)||target.equals(root))throw invalid();
                inspect(target);paths.add(target);
            }
        } catch(IOException failure){throw new ApiFailure(503,"GENERATOR_CUSTOM_OUTPUT_UNAVAILABLE","Custom output cannot inspect its configured directory safely.");}
        var outcomes=new ArrayList<CustomOutputOutcome>();
        for(int index=0;index<files.size();index++){
            var file=files.get(index);Path target=paths.get(index);Path temporary=null;boolean installationStarted=false;
            try {
                inspect(target);Files.createDirectories(target.getParent());inspect(target);
                boolean existed=Files.exists(target,LinkOption.NOFOLLOW_LINKS);
                temporary=Files.createTempFile(target.getParent(),".eforge-generated-",".tmp");
                Files.writeString(temporary,file.content(),StandardCharsets.UTF_8,StandardOpenOption.TRUNCATE_EXISTING);
                inspect(target);
                // Atomic replacement leaves other hard-link identities unchanged.
                installationStarted=true;install(temporary,target);
                temporary=null;outcomes.add(new CustomOutputOutcome(relative(target),existed?State.REPLACED:State.CREATED));
            } catch(IOException|ApiFailure failure){
                outcomes.add(new CustomOutputOutcome(relative(target),failure instanceof IOException && installationStarted?State.UNCONFIRMED:State.FAILED));
                for(int rest=index+1;rest<files.size();rest++)outcomes.add(new CustomOutputOutcome(relative(paths.get(rest)),State.UNATTEMPTED));
                throw new Failure(new CustomOutputResult(outcomes));
            } finally {
                if(temporary!=null)try{Files.deleteIfExists(temporary);}catch(IOException ignored){/* owned temp only; no rollback of committed output */}
            }
        }
        return new CustomOutputResult(outcomes);
    }
    private String relative(Path path){return root.relativize(path).toString().replace('\\','/');}
    protected void install(Path temporary,Path target)throws IOException {
        inspect(target);Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
    }
    private Path destination(String configured) {
        if(configured==null||configured.isBlank())throw invalid();
        try {
            Path path=configured.equals("/")?root:Path.of(configured);
            for(Path segment:path)if(segment.toString().equals(".."))throw invalid();
            path=(path.isAbsolute()?path:root.resolve(path)).toAbsolutePath().normalize();
            if(!path.startsWith(root))throw invalid();return path;
        }catch(InvalidPathException failure){throw invalid();}
    }
    private void inspect(Path target)throws IOException {
        Path current=target.getRoot();
        for(Path part:target){
            current=current.resolve(part);
            if(!Files.exists(current,LinkOption.NOFOLLOW_LINKS))continue;
            BasicFileAttributes attrs=Files.readAttributes(current,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(attrs.isSymbolicLink()||attrs.isOther()||!current.toRealPath().equals(current.toAbsolutePath().normalize()))throw invalid();
            if(current.equals(target)){if(!attrs.isRegularFile()&&!attrs.isDirectory())throw invalid();}
            else if(!attrs.isDirectory())throw invalid();
        }
        if(Files.isDirectory(target,LinkOption.NOFOLLOW_LINKS)&&!target.equals(root))throw invalid();
    }
    private static ApiFailure invalid(){return new ApiFailure(400,"GENERATOR_CUSTOM_PATH_INVALID","Custom output must use regular files within the configured output directory.");}
}