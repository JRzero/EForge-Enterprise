package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.OnlineSessionContracts.*;

@Service
public class OnlineSessionService
{
    private final RedisCache cache;
    public OnlineSessionService(RedisCache cache){this.cache=cache;}
    public PageResponse<OnlineSessionResponse> list(OnlineSessionQuery query)
    {
        try {
            var rows=new ArrayList<OnlineSessionResponse>();
            var keys=cache.keys(CacheConstants.LOGIN_TOKEN_KEY+"*");
            if(keys!=null)for(var key:keys) {
                // Keys can expire between enumeration and reading; never dereference vanished sessions.
                LoginUser session=cache.getCacheObject(key);
                if(session==null||session.getUser()==null||session.getToken()==null)continue;
                if(!session.getToken().matches(SESSION_ID)||!key.equals(CacheConstants.LOGIN_TOKEN_KEY+session.getToken()))continue;
                // Preserve upstream exact (rather than substring) matching for both filters.
                if(query.ip()!=null&&!query.ip().isEmpty()&&!query.ip().equals(session.getIpaddr()))continue;
                if(query.username()!=null&&!query.username().isEmpty()&&!query.username().equals(session.getUsername()))continue;
                rows.add(OnlineSessionResponse.from(session));
            }
            rows.sort(Comparator.comparing(OnlineSessionResponse::loggedInAt,Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(OnlineSessionResponse::id,Comparator.reverseOrder()));
            int page=query.page()==null?1:query.page(),size=query.pageSize()==null?10:query.pageSize();
            int start=(int)Math.min((long)(page-1)*size,rows.size()),end=Math.min(start+size,rows.size());
            return new PageResponse<>(rows.subList(start,end),rows.size(),page,size);
        } catch(DataAccessException unavailable){throw unavailable();}
    }
    public void revoke(String id)
    {
        if(id==null||!id.matches(SESSION_ID))throw new ApiFailure(400,"VALIDATION_ERROR","Invalid session identifier.");
        try {cache.deleteObject(CacheConstants.LOGIN_TOKEN_KEY+id);}
        catch(DataAccessException unavailable){throw unavailable();}
    }
    private ApiFailure unavailable(){return new ApiFailure(503,"ONLINE_SESSIONS_UNAVAILABLE","Online session state is temporarily unavailable.");}
}
