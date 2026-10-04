package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.system.domain.SysPost;

public record PostResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int sort,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
        String remark, Instant createdAt)
{
    static PostResponse from(SysPost post)
    {
        return new PostResponse(post.getPostId().toString(), post.getPostCode(), post.getPostName(),
                post.getPostSort(), post.getStatus(), post.getRemark(),
                post.getCreateTime() == null ? null : post.getCreateTime().toInstant());
    }
}
