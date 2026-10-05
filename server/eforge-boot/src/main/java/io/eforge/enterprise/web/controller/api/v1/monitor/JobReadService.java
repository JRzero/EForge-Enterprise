package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.List;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobContracts.*;

/** Read-only canonical projection of the compatibility task table. */
@Service
public class JobReadService {
    private final SysJobMapper mapper;
    public JobReadService(SysJobMapper mapper){this.mapper=mapper;}
    public PageResponse<JobResponse> list(JobQuery query) {
        int page=query.page()==null?1:query.page(),size=query.pageSize()==null?10:query.pageSize();
        try {PageHelper.startPage(page,size,order(query));var rows=mapper.selectJobList(filter(query));
            return new PageResponse<>(rows.stream().map(JobResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    public JobResponse detail(String id) {
        var row=mapper.selectJobById(identifier(id));
        if(row==null)throw new ApiFailure(404,"JOB_NOT_FOUND","Task does not exist.");
        return JobResponse.from(row);
    }
    public List<SysJob> export(JobQuery query) {
        try {PageHelper.orderBy(order(query));return mapper.selectJobList(filter(query));}finally{PageHelper.clearPage();}
    }
    static String order(JobQuery query) {
        String field=query.sort()==null?"job_id":switch(query.sort()){case id->"job_id";case name->"job_name";case createdAt->"create_time";};
        return field+" "+(query.direction()==null?"asc":query.direction().name())+", job_id asc";
    }
    private static SysJob filter(JobQuery query) {
        var row=new SysJob();row.setJobName(query.name());row.setJobGroup(query.group());row.setInvokeTarget(query.invokeTarget());
        row.setStatus(query.status()==null?null:query.status().toString());return row;
    }
    private static Long identifier(String id) {
        try {long value=Long.parseLong(id);if(value>0)return value;}catch(NumberFormatException|NullPointerException ignored){}
        throw new ApiFailure(400,"VALIDATION_ERROR","Invalid task identifier.");
    }
}