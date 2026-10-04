package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.xss.Xss;
import io.eforge.enterprise.system.domain.SysNotice;
import io.eforge.enterprise.system.mapper.NoticeMutationMapper.ReaderRow;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class NoticeContracts
{
    private NoticeContracts() {}
    public record NoticeRequest(@NotBlank @Size(max=50) @Xss String title,
            @NotNull @Pattern(regexp="[12]") String type,
            String content,
            @NotNull @Pattern(regexp="[01]") String status,
            @Size(max=255) String remark)
    {
        @Override public String toString() { return "NoticeRequest[content redacted]"; }
    }
    public record NoticeIdsRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record NoticeResponse(@Schema(requiredMode=REQUIRED) String id,
            @Schema(requiredMode=REQUIRED) String title, @Schema(requiredMode=REQUIRED) String type,
            @Schema(requiredMode=REQUIRED) String content, @Schema(requiredMode=REQUIRED) String status,
            String createdBy, Instant createdAt, String remark)
    {
        static NoticeResponse from(SysNotice row) {
            return new NoticeResponse(row.getNoticeId().toString(), row.getNoticeTitle(), row.getNoticeType(),
                    row.getNoticeContent()==null ? "" : row.getNoticeContent(), row.getStatus(),
                    row.getCreateBy(), row.getCreateTime()==null ? null : row.getCreateTime().toInstant(), row.getRemark());
        }
    }
    public record NoticeSummary(@Schema(requiredMode=REQUIRED) String id,
            @Schema(requiredMode=REQUIRED) String title, @Schema(requiredMode=REQUIRED) String type,
            String createdBy, Instant createdAt, @Schema(requiredMode=REQUIRED) boolean read)
    {
        static NoticeSummary from(SysNotice row) {
            return new NoticeSummary(row.getNoticeId().toString(),row.getNoticeTitle(),row.getNoticeType(),
                    row.getCreateBy(),row.getCreateTime()==null ? null : row.getCreateTime().toInstant(),row.getIsRead());
        }
    }
    /** Unread count intentionally covers the visible five items, matching upstream. */
    public record NoticeFeed(@Schema(requiredMode=REQUIRED) List<NoticeSummary> items,
            @Schema(requiredMode=REQUIRED) long unreadCount) {}
    public record NoticeReader(@Schema(requiredMode=REQUIRED) String userId,
            String username, String displayName, String departmentName, String phone, Instant readAt)
    {
        static NoticeReader from(ReaderRow row) {
            return new NoticeReader(row.userId().toString(),row.username(),row.displayName(),row.departmentName(),row.phone(),
                    row.readTime()==null ? null : row.readTime().toInstant());
        }
    }
}
