package io.eforge.enterprise.web.controller.api.v1.monitor;

import org.springframework.stereotype.Service;
import org.quartz.SchedulerException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.job.TaskException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.service.ISysJobService;
import io.eforge.enterprise.quartz.util.CronUtils;
import io.eforge.enterprise.quartz.util.TaskInvocationPolicy;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobWriteContracts.*;

/** Full canonical write DTOs enter the already guarded compatibility transaction. */
@Service
public class JobWriteService {
    private final ISysJobService jobs;
    public JobWriteService(ISysJobService jobs){this.jobs=jobs;}
    public JobCreatedResponse create(JobWriteRequest request) {
        SysJob row=entity(request);row.setCreateBy(SecurityUtils.getUsername());
        if(execute(()->jobs.insertJob(row))!=1||row.getJobId()==null)throw unavailable();
        return new JobCreatedResponse(row.getJobId().toString());
    }
    public void update(String id,JobWriteRequest request) {
        long key=identifier(id);SysJob row=entity(request);row.setJobId(key);row.setUpdateBy(SecurityUtils.getUsername());
        if(execute(()->jobs.updateJob(row))!=1)throw missing();
    }
    public void status(String id,JobStatusRequest request) {
        SysJob row=new SysJob();row.setJobId(identifier(id));row.setStatus(request.status());row.setUpdateBy(SecurityUtils.getUsername());
        if(execute(()->jobs.changeStatus(row))!=1)throw missing();
    }
    public void run(String id) {
        SysJob row=new SysJob();row.setJobId(identifier(id));
        if(!execute(()->jobs.run(row)))throw new ApiFailure(409,"JOB_NOT_RUNNABLE","Task does not exist or has no remaining scheduled execution.");
    }
    public void delete(JobDeleteRequest request) {
        Long[] ids=request.ids().stream().map(JobWriteService::identifier).distinct().toArray(Long[]::new);
        execute(()->{jobs.deleteJobByIds(ids);return null;});
    }
    private static SysJob entity(JobWriteRequest request) {
        if(!CronUtils.isValid(request.cronExpression()))throw new ApiFailure(400,"JOB_CRON_INVALID","Invalid Quartz cron expression.");
        try{TaskInvocationPolicy.validate(request.invokeTarget());}
        catch(IllegalArgumentException failure){throw new ApiFailure(400,"JOB_TARGET_INVALID","Invalid or disallowed task invocation target.");}
        SysJob row=new SysJob();row.setJobName(request.name());row.setJobGroup(request.group());row.setInvokeTarget(request.invokeTarget());
        row.setCronExpression(request.cronExpression());row.setMisfirePolicy(request.misfirePolicy());row.setConcurrent(request.concurrent()?"0":"1");
        row.setStatus(request.status());row.setRemark(request.remark()==null?"":request.remark());return row;
    }
    private static long identifier(String id) {
        try {if(id!=null&&id.matches("[1-9][0-9]{0,18}")){long value=Long.parseLong(id);if(value>0)return value;}}
        catch(NumberFormatException ignored){}
        throw new ApiFailure(400,"VALIDATION_ERROR","Invalid task identifier.");
    }
    @FunctionalInterface private interface Operation<T>{T execute()throws SchedulerException,TaskException;}
    private static <T> T execute(Operation<T> operation) {
        try{return operation.execute();}
        catch(ApiFailure failure){throw failure;}
        catch(SchedulerException|TaskException|RuntimeException failure){throw unavailable();}
    }
    private static ApiFailure missing(){return new ApiFailure(404,"JOB_NOT_FOUND","Task does not exist.");}
    private static ApiFailure unavailable(){return new ApiFailure(503,"JOB_SCHEDULE_UNAVAILABLE","Task scheduling is temporarily unavailable.");}
}
