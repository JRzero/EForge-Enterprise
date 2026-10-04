package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataAccessException;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.eforge.enterprise.common.core.domain.BaseEntity;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.service.SysPasswordService;
import io.eforge.enterprise.system.domain.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.LogContracts.*;

@Service
public class LogService
{
    private final SysOperLogMapper operations;
    private final SysLogininforMapper logins;
    private final SysPasswordService passwords;
    public LogService(SysOperLogMapper operations,SysLogininforMapper logins,SysPasswordService passwords)
    {this.operations=operations;this.logins=logins;this.passwords=passwords;}
    public PageResponse<OperationLogResponse> operations(OperationQuery query)
    {
        var filter=operationFilter(query);int page=page(query.page()),size=size(query.pageSize());
        try {
            PageHelper.startPage(page,size,operationOrder(query));var rows=operations.selectOperLogList(filter);
            return new PageResponse<>(rows.stream().map(OperationLogResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    public PageResponse<LoginLogResponse> logins(LoginQuery query)
    {
        var filter=loginFilter(query);int page=page(query.page()),size=size(query.pageSize());
        try {
            PageHelper.startPage(page,size,loginOrder(query));var rows=logins.selectLogininforList(filter);
            return new PageResponse<>(rows.stream().map(LoginLogResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    public OperationLogDetail operation(String id)
    {var row=operations.selectOperLogById(identifier(id));if(row==null)throw new ApiFailure(404,"OPERATION_LOG_NOT_FOUND","Operation log does not exist.");return OperationLogDetail.from(row);}
    public List<SysOperLog> exportOperations(OperationQuery query)
    {var filter=operationFilter(query);try{PageHelper.orderBy(operationOrder(query));return operations.selectOperLogList(filter);}finally{PageHelper.clearPage();}}
    public List<SysLogininfor> exportLogins(LoginQuery query)
    {var filter=loginFilter(query);try{PageHelper.orderBy(loginOrder(query));return logins.selectLogininforList(filter);}finally{PageHelper.clearPage();}}
    // One SQL statement is atomic. Missing immutable log IDs are idempotent, as in the compatibility API.
    public void deleteOperations(List<String> ids){operations.deleteOperLogByIds(ids.stream().distinct().map(LogService::identifier).toArray(Long[]::new));}
    public void deleteLogins(List<String> ids){logins.deleteLogininforByIds(ids.stream().distinct().map(LogService::identifier).toArray(Long[]::new));}
    public void clearOperations(){operations.cleanOperLog();}
    public void clearLogins(){logins.cleanLogininfor();}
    public void unlock(String username)
    {try{passwords.clearLoginRecordCache(username);}catch(DataAccessException unavailable){throw new ApiFailure(503,"LOGIN_UNLOCK_UNAVAILABLE","Login failure state could not be cleared.");}}
    private static int page(Integer value){return value==null?1:value;}
    private static int size(Integer value){return value==null?10:value;}
    private static Long identifier(String id)
    {try{long value=Long.parseLong(id);if(value>0)return value;}catch(NumberFormatException|NullPointerException ignored){}throw new ApiFailure(400,"VALIDATION_ERROR","Invalid log identifier.");}
    private static SysOperLog operationFilter(OperationQuery query)
    {var row=new SysOperLog();row.setOperIp(query.ip());row.setTitle(query.title());row.setOperName(query.operator());row.setBusinessType(query.businessType());row.setStatus(query.status());dates(row,query.from(),query.to());return row;}
    private static SysLogininfor loginFilter(LoginQuery query)
    {var row=new SysLogininfor();row.setIpaddr(query.ip());row.setUserName(query.username());row.setStatus(query.status()==null?null:query.status().toString());dates(row,query.from(),query.to());return row;}
    private static void dates(BaseEntity filter,LocalDate from,LocalDate to)
    {
        if(from!=null&&to!=null&&from.isAfter(to))throw new ApiFailure(400,"VALIDATION_ERROR","Invalid date range.");
        if(from!=null)filter.getParams().put("beginTime",from+" 00:00:00");
        if(to!=null)filter.getParams().put("endTime",to+" 23:59:59");
    }
    static String operationOrder(OperationQuery query)
    {String column=switch(query.sort()==null?OperationSort.time:query.sort()){case operator->"oper_name";case time->"oper_time";case duration->"cost_time";};return column+" "+direction(query.direction())+", oper_id desc";}
    static String loginOrder(LoginQuery query)
    {String column=switch(query.sort()==null?LoginSort.time:query.sort()){case username->"user_name";case time->"login_time";};return column+" "+direction(query.direction())+", info_id desc";}
    private static String direction(Direction direction){return direction==null?"desc":direction.name();}
}
