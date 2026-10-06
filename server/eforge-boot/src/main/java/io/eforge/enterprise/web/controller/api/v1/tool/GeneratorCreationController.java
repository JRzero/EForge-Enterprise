package io.eforge.enterprise.web.controller.api.v1.tool;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.generator.service.GeneratorCreationCommand;

@RestController
@RequestMapping("/api/v1/tool/generator/creations")
public class GeneratorCreationController {
    public record GeneratorCreationRequest(@NotBlank @Size(max=65536) @Schema(requiredMode=Schema.RequiredMode.REQUIRED,accessMode=Schema.AccessMode.WRITE_ONLY) String sql,
        @Pattern(regexp="element-ui|element-plus|element-plus-typescript|eforge-react") String template) {}
    public static final class CreationProblem extends ProblemDetail {
        private final String code;
        private final GeneratorCreationCommand.Creation creation;
        public CreationProblem(GeneratorCreationCommand.Failure failure,HttpServletRequest request) {
            super(failure.status());
            code=failure.code();creation=failure.creation();
            setTitle(HttpStatus.valueOf(failure.status()).getReasonPhrase());
            setDetail(failure.getMessage());setInstance(URI.create(request.getRequestURI()));
        }
        @Override @Schema(hidden=true) public java.util.Map<String,Object> getProperties(){return super.getProperties();}
        public String getCode(){return code;}
        public GeneratorCreationCommand.Creation getCreation(){return creation;}
    }
    private final GeneratorCreationCommand command;
    public GeneratorCreationController(GeneratorCreationCommand command){this.command=command;}
    @PostMapping(produces=MediaType.APPLICATION_JSON_VALUE) @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@ss.hasRole('admin')")
    @Log(title="创建表",businessType=BusinessType.OTHER,isSaveRequestData=false)
    @Operation(operationId="createGeneratorTables",description="Creates the prevalidated SQL batch and imports metadata. Physical DDL is not rolled back on partial failure; inspect the returned outcomes.")
    @ApiResponses({
        @ApiResponse(responseCode="201",content=@Content(schema=@Schema(implementation=GeneratorCreationCommand.Creation.class))),
        @ApiResponse(responseCode="400",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class))),
        @ApiResponse(responseCode="401",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class))),
        @ApiResponse(responseCode="403",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class))),
        @ApiResponse(responseCode="409",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class))),
        @ApiResponse(responseCode="500",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class))),
        @ApiResponse(responseCode="503",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=CreationProblem.class)))
    })
    public GeneratorCreationCommand.Creation create(@Valid @RequestBody GeneratorCreationRequest request) {
        return command.create(request.sql(),request.template()==null?"eforge-react":request.template());
    }
    @ExceptionHandler(GeneratorCreationCommand.Failure.class)
    public ResponseEntity<CreationProblem> partialFailure(GeneratorCreationCommand.Failure failure,HttpServletRequest request) {
        return ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore())
            .contentType(MediaType.APPLICATION_PROBLEM_JSON).body(new CreationProblem(failure,request));
    }
}
