package io.eforge.enterprise.generator.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.service.GeneratorCreationCommand;

/** RuoYi MIT compatibility boundary for the original admin creation action. */
@RestController
public class GeneratorCreationLegacyController {
    private final GeneratorCreationCommand command;
    public GeneratorCreationLegacyController(GeneratorCreationCommand command){this.command=command;}
    @PostMapping("/tool/gen/createTable")
    @PreAuthorize("@ss.hasRole('admin')")
    @Log(title="创建表",businessType=BusinessType.OTHER,isSaveRequestData=false)
    public AjaxResult create(@RequestParam("sql") String sql,@RequestParam("tplWebType") String template) {
        return AjaxResult.success(command.create(sql,template));
    }
    @ExceptionHandler(GeneratorCreationCommand.Failure.class)
    public AjaxResult partialFailure(GeneratorCreationCommand.Failure failure) {
        return AjaxResult.error(failure.getMessage(),failure.creation()).put("failureCode",failure.code());
    }
    @ExceptionHandler(ApiFailure.class)
    public AjaxResult rejected(ApiFailure failure) {
        return AjaxResult.error(failure.getMessage()).put("failureCode",failure.code());
    }
}
