package io.eforge.enterprise.web.controller.api.v1.tool;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import io.eforge.enterprise.generator.config.GenConfig;
import io.eforge.enterprise.generator.rendering.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorCustomOutputTest {
    @TempDir Path directory;
    boolean previous;
    @BeforeEach void enable(){previous=GenConfig.allowOverwrite;GenConfig.allowOverwrite=true;}
    @AfterEach void restore(){GenConfig.allowOverwrite=previous;}
    GeneratorRenderingSnapshot snapshot(String destination){
        var table=new GeneratorOutputControllerTest().table(11,"CustomEntry");table.setGenPath(destination);table.setPkColumn(table.getColumns().get(0));
        return GeneratorRenderingSnapshot.capture(table);
    }
    @Test void actualFullBackendFilesMatchCompletedBundleAndAtomicOverwrite()throws Exception{
        Path root=directory.resolve("output");var input=snapshot("/");var writer=new GeneratorCustomOutput(root.toString());
        var expected=GeneratorRenderedBundle.render(input).files().stream().filter(f->f.template().startsWith("vm/java/")||f.template().startsWith("vm/xml/")).toList();
        var first=writer.write(input);assertEquals(6,first.files().size());
        assertTrue(first.files().stream().allMatch(f->f.state()==GeneratorCustomOutput.State.CREATED));
        for(var file:expected)assertEquals(file.content(),Files.readString(root.resolve(file.path())));
        assertFalse(Files.exists(root.resolve("sql")));assertFalse(Files.exists(root.resolve("vue")));
        var next=writer.write(input);assertTrue(next.files().stream().allMatch(f->f.state()==GeneratorCustomOutput.State.REPLACED));
        try(var paths=Files.walk(root)){assertFalse(paths.anyMatch(p->p.getFileName().toString().startsWith(".eforge-generated-")));}
        assertThrows(UnsupportedOperationException.class,()->next.files().clear());
    }
    @Test void disabledOutputAndWholeBundlePathRefusalLeaveAllFilesUntouched()throws Exception{
        Path root=directory.resolve("output");var writer=new GeneratorCustomOutput(root.toString());
        GenConfig.allowOverwrite=false;assertEquals(403,assertThrows(ApiFailure.class,()->writer.write(snapshot("/"))).status());assertFalse(Files.exists(root));
        GenConfig.allowOverwrite=true;
        for(String destination:List.of("../escape",directory.resolve("outside").toString())){
            assertEquals(400,assertThrows(ApiFailure.class,()->writer.write(snapshot(destination))).status());assertFalse(Files.exists(root));
        }
        var table=new GeneratorOutputControllerTest().table(11,"CustomEntry");table.setGenPath("/");table.setPkColumn(table.getColumns().get(0));table.setModuleName("../escape");
        assertEquals(400,assertThrows(ApiFailure.class,()->writer.write(GeneratorRenderingSnapshot.capture(table))).status());assertFalse(Files.exists(root));
    }
    @Test void existingDirectoryInsteadOfAnyOutputFileRefusesBeforeFirstWrite()throws Exception{
        Path root=directory.resolve("output");var input=snapshot("/");var files=GeneratorRenderedBundle.render(input).files();
        Path conflict=root.resolve(files.get(1).path());Files.createDirectories(conflict);
        assertEquals(400,assertThrows(ApiFailure.class,()->new GeneratorCustomOutput(root.toString()).write(input)).status());
        assertFalse(Files.exists(root.resolve(files.get(0).path())));assertTrue(Files.isDirectory(conflict));
    }
    @org.junit.jupiter.params.ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(booleans={false,true})
    void realEarlierFilesRemainAndLaterFilesAreUnattemptedOnIoFailure(boolean afterInstall)throws Exception{
        Path root=directory.resolve("output");var writer=new GeneratorCustomOutput(root.toString()){
            int calls;
            @Override protected void install(Path temporary,Path target)throws IOException{
                boolean failing=++calls==2;if(failing&&!afterInstall)throw new IOException("private driver/path details");super.install(temporary,target);if(failing)throw new IOException("private lost acknowledgement");
            }
        };
        var failure=assertThrows(GeneratorCustomOutput.Failure.class,()->writer.write(snapshot("/")));
        assertFalse(failure.getMessage().contains("private"));assertEquals(6,failure.result().files().size());
        assertEquals(GeneratorCustomOutput.State.CREATED,failure.result().files().get(0).state());
        assertTrue(Files.isRegularFile(root.resolve(failure.result().files().get(0).path())));
        assertEquals(GeneratorCustomOutput.State.UNCONFIRMED,failure.result().files().get(1).state());
        assertEquals(afterInstall,Files.isRegularFile(root.resolve(failure.result().files().get(1).path())));
        assertTrue(failure.result().files().subList(2,6).stream().allMatch(f->f.state()==GeneratorCustomOutput.State.UNATTEMPTED));
        try(var paths=Files.walk(root)){assertFalse(paths.anyMatch(p->p.getFileName().toString().startsWith(".eforge-generated-")));}
    }
    @Test void atomicReplacementDoesNotChangeAnOutsideHardLinkIdentity()throws Exception{
        Path root=directory.resolve("output");var input=snapshot("/");var first=GeneratorRenderedBundle.render(input).files().get(0);
        Path target=root.resolve(first.path());Files.createDirectories(target.getParent());Path outside=directory.resolve("retained.txt");Files.writeString(outside,"保留原内容");Files.createLink(target,outside);
        new GeneratorCustomOutput(root.toString()).write(input);assertEquals("保留原内容",Files.readString(outside));assertEquals(first.content(),Files.readString(target));assertFalse(Files.isSameFile(target,outside));
    }
    @Test void existingSymlinkCannotRedirectOutput()throws Exception{
        Path root=directory.resolve("output"),outside=directory.resolve("outside");Files.createDirectories(root);Files.createDirectories(outside);
        try{Files.createSymbolicLink(root.resolve("main"),outside);}catch(FileSystemException unsupported){Assumptions.abort("Host cannot create symlinks: "+unsupported.getClass().getSimpleName());}
        assertEquals(400,assertThrows(ApiFailure.class,()->new GeneratorCustomOutput(root.toString()).write(snapshot("/"))).status());
        try(var paths=Files.list(outside)){assertEquals(0,paths.count());}
    }
    @Test void actualWindowsJunctionCannotRedirectOutput()throws Exception{
        Assumptions.assumeTrue(System.getProperty("os.name").startsWith("Windows"));
        Path root=directory.resolve("output"),outside=directory.resolve("outside");Files.createDirectories(root);Files.createDirectories(outside);
        var process=new ProcessBuilder("cmd","/c","mklink","/J",root.resolve("main").toString(),outside.toString()).redirectErrorStream(true).start();
        String diagnostics=new String(process.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);assertEquals(0,process.waitFor(),diagnostics);
        assertEquals(400,assertThrows(ApiFailure.class,()->new GeneratorCustomOutput(root.toString()).write(snapshot("/"))).status());
        try(var paths=Files.list(outside)){assertEquals(0,paths.count());}
    }    @Test void nestedUnicodeDestinationReportsActualPathsWithoutAbsoluteRoot()throws Exception{
        Path root=directory.resolve("output");var result=new GeneratorCustomOutput(root.toString()).write(snapshot("模块/子目录"));
        for(var outcome:result.files()){
            assertTrue(outcome.path().startsWith("模块/子目录/main/"));assertTrue(Files.isRegularFile(root.resolve(outcome.path())));
            assertFalse(outcome.path().contains(directory.toString()));
        }
    }    @org.springframework.context.annotation.Configuration(proxyBeanMethods=false)
    @org.springframework.context.annotation.PropertySource("classpath:generator.yml")
    static class RootSettings {}
    @org.junit.jupiter.params.ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(booleans={false,true})
    void actualSpringRootConfigurationAcceptsLegacyKeyAndPrefixedOverride(boolean prefixed)throws Exception{
        Path legacy=directory.resolve("legacy"),canonical=directory.resolve("canonical");
        var settings=new java.util.HashMap<String,Object>();settings.put("user.dir",directory.toString());settings.put("outputRoot",legacy.toString());if(prefixed)settings.put("gen.outputRoot",canonical.toString());
        try(var context=new org.springframework.context.annotation.AnnotationConfigApplicationContext()){
            context.getEnvironment().getPropertySources().remove("systemEnvironment");context.getEnvironment().getPropertySources().remove("systemProperties");
            context.getEnvironment().getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("owned-root-test",settings));
            context.register(RootSettings.class,GeneratorCustomOutput.class);context.refresh();
            var result=context.getBean(GeneratorCustomOutput.class).write(snapshot("/"));Path expected=prefixed?canonical:legacy;
            for(var outcome:result.files())assertTrue(Files.isRegularFile(expected.resolve(outcome.path())));
            assertFalse(Files.exists(prefixed?legacy:canonical));
        }
    }}