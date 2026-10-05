package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;
import java.text.ParseException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.quartz.CronExpression;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.exception.ApiFailure;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/** Preview uses Quartz's actual syntax and server timezone, including exhausted expressions. */
@RestController
@RequestMapping("/api/v1/monitor/jobs")
public class CronPreviewController
{
    private final Clock clock;
    public CronPreviewController(){this(Clock.systemDefaultZone());}
    CronPreviewController(Clock clock){this.clock=clock;}
    public record CronPreviewQuery(@NotBlank @Size(max=255) String expression) {}
    public record CronPreviewResponse(@Schema(requiredMode=REQUIRED) String zone,
            @Schema(requiredMode=REQUIRED) List<Instant> times) {}
    @GetMapping("/cron-preview")
    @PreAuthorize("@ss.hasAnyPermi('monitor:job:add,monitor:job:edit,monitor:job:query')")
    @Operation(operationId="previewJobCron")
    public CronPreviewResponse preview(@Valid @ModelAttribute @ParameterObject CronPreviewQuery query) {
        try {
            var cron=new CronExpression(query.expression());cron.setTimeZone(TimeZone.getTimeZone(clock.getZone()));
            var times=new ArrayList<Instant>();Date previous=Date.from(clock.instant());
            for(int i=0;i<5;i++){previous=cron.getNextValidTimeAfter(previous);if(previous==null)break;times.add(previous.toInstant());}
            return new CronPreviewResponse(clock.getZone().getId(),List.copyOf(times));
        } catch(ParseException invalid){throw new ApiFailure(400,"JOB_CRON_INVALID","Invalid Quartz cron expression.");}
    }
}
