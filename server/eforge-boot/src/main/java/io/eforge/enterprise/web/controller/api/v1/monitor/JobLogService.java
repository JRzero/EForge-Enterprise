package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.List;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.quartz.domain.SysJobLog;
import io.eforge.enterprise.quartz.mapper.SysJobLogMapper;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobLogContracts.*;

/** RuoYi job-log objects remain behind the canonical projection/export boundary. */
@Service
public class JobLogService
{
    private final SysJobLogMapper mapper;
    public JobLogService(SysJobLogMapper mapper){this.mapper=mapper;}
    public PageResponse<JobLogResponse> list(JobLogQuery query) {
        var filter=filter(query);int page=query.page()==null?1:query.page(),size=query.pageSize()==null?10:query.pageSize();
        try {PageHelper.startPage(page,size,order(query));var rows=mapper.selectJobLogList(filter);
            return new PageResponse<>(rows.stream().map(JobLogResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    public JobLogDetail detail(String id) {
        var row=mapper.selectJobLogById(identifier(id));
        if(row==null)throw new ApiFailure(404,"JOB_LOG_NOT_FOUND","Job log does not exist.");
        return new JobLogDetail(JobLogResponse.from(row),row.getExceptionInfo());
    }
    public List<SysJobLog> export(JobLogQuery query) {
        var filter=filter(query);try {PageHelper.orderBy(order(query));return mapper.selectJobLogList(filter);} finally {PageHelper.clearPage();}
    }
    public void delete(List<String> ids) {mapper.deleteJobLogByIds(ids.stream().distinct().map(JobLogService::identifier).toArray(Long[]::new));}
    public void clear() {mapper.deleteAllJobLogs();}
    static String order(JobLogQuery query){return "create_time "+(query.direction()==null?"desc":query.direction().name())+", job_log_id desc";}
    private static SysJobLog filter(JobLogQuery query) {
        if(query.from()!=null&&query.to()!=null&&query.from().isAfter(query.to()))throw new ApiFailure(400,"VALIDATION_ERROR","Invalid date range.");
        var row=new SysJobLog();row.setJobName(query.name());row.setJobGroup(query.group());row.setInvokeTarget(query.invokeTarget());row.setStatus(query.status()==null?null:query.status().toString());
        if(query.from()!=null)row.getParams().put("beginTime",query.from()+" 00:00:00");
        if(query.to()!=null)row.getParams().put("endTime",query.to()+" 23:59:59");
        return row;
    }
    private static Long identifier(String id) {
        try {long value=Long.parseLong(id);if(value>0)return value;}catch(NumberFormatException|NullPointerException ignored){}
        throw new ApiFailure(400,"VALIDATION_ERROR","Invalid job log identifier.");
    }
}
