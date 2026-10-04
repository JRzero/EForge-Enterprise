package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.core.domain.entity.SysDept;

@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
public record DepartmentResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String parentId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int sort,
        String leader, String phone, String email,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status, Instant createdAt)
{
    static DepartmentResponse from(SysDept department)
    {
        return new DepartmentResponse(department.getDeptId().toString(), department.getParentId().toString(),
                department.getDeptName(), department.getOrderNum(), department.getLeader(), department.getPhone(),
                department.getEmail(), department.getStatus(), department.getCreateTime() == null ? null : department.getCreateTime().toInstant());
    }
}
