package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.rendering.*;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorOutputContracts.*;

@Service
public class GeneratorOutputService {
    private final GeneratorRenderingSnapshotLoader snapshots;
    private final GeneratorCustomOutput custom;
    public GeneratorOutputService(GeneratorRenderingSnapshotLoader snapshots,GeneratorCustomOutput custom){this.snapshots=snapshots;this.custom=custom;}
    @PreAuthorize("@ss.hasPermi('tool:gen:preview')")
    public PreviewResponse preview(String id) {
        long selected=identifier(id);
        var snapshot=snapshots.load(List.of(selected)).get(0);
        var bundle=GeneratorRenderedBundle.render(snapshot);
        return new PreviewResponse(Long.toString(selected),snapshot.generationDate(),bundle.files().stream()
            .map(file->new OutputFile(file.template(),file.path(),file.content())).toList());
    }
    @PreAuthorize("@ss.hasPermi('tool:gen:code')")
    public byte[] download(List<String> ids) {
        if(ids==null||ids.isEmpty()||ids.size()>100)throw selection();
        var selected=ids.stream().map(GeneratorOutputService::identifier).toList();
        if(new HashSet<>(selected).size()!=selected.size())throw selection();
        var input=snapshots.load(selected);
        return GeneratorRenderedBundle.combine(()->input.stream().map(GeneratorRenderedBundle::render).iterator()).zip();
    }
    @PreAuthorize("@ss.hasPermi('tool:gen:code')")
    public GeneratorCustomOutput.CustomOutputResult custom(String id){custom.requireEnabled();return custom.write(snapshots.load(List.of(identifier(id))).get(0));}
    private static long identifier(String id) {
        try{if(id!=null&&id.matches("[1-9][0-9]{0,18}")){long value=Long.parseLong(id);if(value>0)return value;}}catch(NumberFormatException ignored){}
        throw new ApiFailure(400,"VALIDATION_ERROR","Invalid generator identifier.");
    }
    private static ApiFailure selection(){return new ApiFailure(400,"GENERATOR_SNAPSHOT_SELECTION_INVALID","Select distinct valid generator configurations.");}
}