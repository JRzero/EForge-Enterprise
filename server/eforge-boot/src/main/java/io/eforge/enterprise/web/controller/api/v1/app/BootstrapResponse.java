package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import java.util.Set;
import io.swagger.v3.oas.annotations.media.Schema;

public record BootstrapResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UserSummary user,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Set<String> roles,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Set<String> permissions,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<NavigationNode> navigation, PasswordStatus passwordStatus)
{
    public record UserSummary(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName, String avatarUrl) { }
    public record PasswordStatus(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String characterType, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean initialChangeRecommended, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean expired)
    {
        static PasswordStatus from(String type, Integer initial, Integer validityDays, java.util.Date updated, java.util.Date now)
        {
            boolean first = Integer.valueOf(1).equals(initial) && updated == null;
            boolean expired = validityDays != null && validityDays > 0 && (updated == null
                    || io.eforge.enterprise.common.utils.DateUtils.differentDaysByMillisecond(now,updated) > validityDays);
            return new PasswordStatus(type,first,expired);
        }
    }
}