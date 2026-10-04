package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.domain.SysNotice;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.NoticeContracts.*;

@Service
public class NoticeService
{
    private final SysNoticeMapper notices;
    private final SysNoticeReadMapper reads;
    private final NoticeMutationMapper writes;
    private final DepartmentMutationMapper mutex;
    private final TransactionTemplate transaction;
    public NoticeService(SysNoticeMapper notices, SysNoticeReadMapper reads, NoticeMutationMapper writes,
            DepartmentMutationMapper mutex, PlatformTransactionManager transactions)
    {
        this.notices=notices; this.reads=reads; this.writes=writes; this.mutex=mutex;
        transaction=new TransactionTemplate(transactions);
    }
    public PageResponse<NoticeResponse> list(int page,int size,String title,String author,String type)
    {
        var filter=new SysNotice(); filter.setNoticeTitle(title); filter.setCreateBy(author); filter.setNoticeType(type);
        try {
            PageHelper.startPage(page,size,"notice_id desc"); var rows=notices.selectNoticeList(filter);
            return new PageResponse<>(rows.stream().map(NoticeResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally { PageHelper.clearPage(); }
    }
    public NoticeResponse get(String id) { return NoticeResponse.from(require(identifier(id))); }
    public NoticeResponse create(NoticeRequest request)
    {
        return locked(() -> {
            var row=row(request); row.setCreateBy(SecurityUtils.getUsername()); writes.insert(row);
            return NoticeResponse.from(require(row.getNoticeId()));
        });
    }
    public void update(String id,NoticeRequest request)
    {
        locked(() -> {
            var old=require(identifier(id)); var row=row(request); row.setNoticeId(old.getNoticeId());
            row.setUpdateBy(SecurityUtils.getUsername()); writes.update(row); return null;
        });
    }
    public void delete(List<String> ids)
    {
        locked(() -> {
            var rows=ids.stream().distinct().map(NoticeService::identifier).map(this::require).toList();
            var keys=rows.stream().map(SysNotice::getNoticeId).toArray(Long[]::new);
            reads.deleteByNoticeIds(keys); notices.deleteNoticeByIds(keys); return null;
        });
    }
    public NoticeFeed feed()
    {
        var items=reads.selectNoticeListWithReadStatus(SecurityUtils.getUserId(),5).stream().map(NoticeSummary::from).toList();
        return new NoticeFeed(items,items.stream().filter(item -> !item.read()).count());
    }
    public void markRead(List<String> ids)
    {
        locked(() -> {
            var keys=ids.stream().distinct().map(NoticeService::identifier).toList();
            keys.forEach(this::require);
            reads.insertNoticeReadBatch(SecurityUtils.getUserId(),keys.toArray(Long[]::new)); return null;
        });
    }
    public PageResponse<NoticeReader> readers(String id,int page,int size,String search)
    {
        var key=identifier(id); require(key);
        try {
            PageHelper.startPage(page,size); var rows=writes.selectReaders(key,search);
            return new PageResponse<>(rows.stream().map(NoticeReader::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally { PageHelper.clearPage(); }
    }
    private <T>T locked(Supplier<T> work)
    {
        return transaction.execute(status -> {
            if(mutex.lockRoot()==null) throw new ApiFailure(409,"DEPARTMENT_ROOT_MISSING","Mutation root is missing.");
            return work.get();
        });
    }
    private SysNotice require(Long id)
    {
        var row=notices.selectNoticeById(id);
        if(row==null) throw new ApiFailure(404,"NOTICE_NOT_FOUND","Notice does not exist."); return row;
    }
    private static Long identifier(String id)
    {
        try { long value=Long.parseLong(id); if(value>0)return value; } catch(NumberFormatException|NullPointerException ignored) {}
        throw new ApiFailure(400,"VALIDATION_ERROR","Invalid notice identifier.");
    }
    private static SysNotice row(NoticeRequest request)
    {
        var row=new SysNotice(); row.setNoticeTitle(request.title()); row.setNoticeType(request.type());
        row.setNoticeContent(request.content()==null ? "" : request.content()); row.setStatus(request.status());
        row.setRemark(request.remark()==null ? "" : request.remark()); return row;
    }
}
