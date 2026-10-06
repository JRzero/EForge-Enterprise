package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import static io.eforge.enterprise.web.controller.api.v1.system.MenuContracts.*;

@Service
public class MenuService
{
    private final MenuMutationMapper mapper;
    private final ISysMenuService legacy;
    private final DepartmentMutationMapper mutex;
    private final MenuRouteCatalog routes;
    private final RoleSessionRefresher sessions;
    private final ISysUserService users;
    private final NavigationMapper navigation;
    private final SysPermissionService permissions;
    private final TransactionTemplate transaction;
    public MenuService(MenuMutationMapper mapper,ISysMenuService legacy,DepartmentMutationMapper mutex,MenuRouteCatalog routes,
            RoleSessionRefresher sessions,ISysUserService users,NavigationMapper navigation,SysPermissionService permissions,PlatformTransactionManager manager)
    {this.mapper=mapper;this.legacy=legacy;this.mutex=mutex;this.routes=routes;this.sessions=sessions;this.users=users;this.navigation=navigation;this.permissions=permissions;transaction=new TransactionTemplate(manager);}
    public List<MenuResponse> list(String name,String status,Boolean visible)
    {
        Set<Long> available=available();Set<Long> matching=new HashSet<>(mapper.filteredIds(name,status,visible==null?null:visible?"0":"1"));
        return mapper.rows().stream().filter(row->available.contains(row.id()) && matching.contains(row.id())).map(this::response).toList();
    }
    public MenuResponse get(String id) { return response(require(identifier(id),mapper.rows(),available())); }
    public List<MenuResponse> options(String excludeId)
    {
        var rows=mapper.rows();var available=available();Set<Long> excluded=new HashSet<>();
        if(excludeId!=null) {
            excluded.add(require(identifier(excludeId),rows,available).id());
            boolean changed=true;while(changed) {changed=false;for(var row:rows) if(excluded.contains(row.parentId()) && excluded.add(row.id())) changed=true;}
        }
        return rows.stream().filter(row->available.contains(row.id()) && !excluded.contains(row.id())).map(this::response).toList();
    }
    public List<MenuRouteOption> routeOptions() { return routes.options(); }
    public MenuResponse create(MenuWriteRequest request)
    {
        return mutate(()-> {
            var rows=mapper.rows();var available=available();validate(request,null,rows,available);
            SysMenu row=new SysMenu();row.setParentId(identifier(request.parentId()));row.setMenuName(request.name());row.setOrderNum(request.sort());
            row.setMenuType(menuType(request.type()));row.setIsFrame(request.type()==Type.EXTERNAL ? "0" : "1");
            row.setPath(path(request,null));row.setStatus(request.status());row.setVisible(request.visible()?"0":"1");row.setPerms(clean(request.permission()));
            row.setIcon(clean(request.icon()));row.setRemark(clean(request.remark()));row.setQuery(clean(request.queryText()));row.setIsCache(request.cached()?"0":"1");
            row.setCreateBy(SecurityUtils.getUsername());mapper.insert(row);
            if(row.getMenuId()==null) throw conflict("MENU_WRITE_CONFLICT");
            write(row.getMenuId(),request,path(request,null));
            return new MenuResponse(row.getMenuId().toString(),request.parentId(),request.key(),request.name(),request.sort(),request.type(),request.status(),request.visible(),nullable(request.routeId()),request.type()==Type.EXTERNAL?request.externalUrl():null,clean(request.permission()),clean(request.icon()),clean(request.remark()),request.type()==Type.GROUP?clean(request.groupPath()):null,clean(request.queryText()),request.cached(),null);
        },new HashSet<>());
    }
    public void update(String id,MenuWriteRequest request)
    {
        Set<Long> affected=new HashSet<>();mutate(()-> {
            var rows=mapper.rows();var available=available();var old=require(identifier(id),rows,available);
            validate(request,old,rows,available);affected.addAll(mapper.affectedUsers(old.id()));write(old.id(),request,path(request,old));return null;
        },affected);
    }
    public void delete(String id)
    {
        mutate(()-> {
            var rows=mapper.rows();var row=require(identifier(id),rows,available());
            if(rows.stream().anyMatch(child->child.parentId().equals(row.id()))) throw conflict("MENU_HAS_CHILDREN");
            if(mapper.roleCount(row.id())>0) throw conflict("MENU_IN_USE");
            if(legacy.deleteMenuById(row.id())!=1) throw conflict("MENU_WRITE_CONFLICT");return null;
        },new HashSet<>());
    }
    public void sort(MenuSortRequest request)
    {
        mutate(()-> {
            var rows=mapper.rows();var available=available();Set<Long> ids=new HashSet<>();
            for(var item:request.items()) { Long id=identifier(item.id());require(id,rows,available);if(!ids.add(id)) throw invalid(); }
            legacy.updateMenuSort(request.items().stream().map(MenuSortItem::id).toArray(String[]::new),request.items().stream().map(item->item.sort().toString()).toArray(String[]::new));return null;
        },new HashSet<>());
    }
    private void validate(MenuWriteRequest request,MenuMutationMapper.Row old,List<MenuMutationMapper.Row> rows,Set<Long> available)
    {
        Long parent=identifier(request.parentId());
        if(old!=null && old.key()!=null && !old.key().equals(request.key())) throw conflict("MENU_KEY_IMMUTABLE");
        if(parent!=0) {
            // Retain an inaccessible existing parent, but never assign a new inaccessible parent.
            var owner=old!=null && old.parentId().equals(parent) ? rows.stream().filter(row->row.id().equals(parent)).findFirst().orElseThrow(()->invalid()) : require(parent,rows,available);
            if(type(owner)==Type.FUNCTION || type(owner)==Type.EXTERNAL) throw invalid();
        }
        Map<Long,Long> parents=new HashMap<>();rows.forEach(row->parents.put(row.id(),row.parentId()));
        parents.put(old==null ? -1L : old.id(),parent);
        for(Long id:parents.keySet()) {Set<Long> seen=new HashSet<>();Long cursor=id;while(parents.containsKey(cursor)) {if(!seen.add(cursor) || seen.size()>64) throw conflict("MENU_CYCLE");cursor=parents.get(cursor);} }
        boolean children=old!=null && rows.stream().anyMatch(row->row.parentId().equals(old.id()));
        if(children && (request.type()==Type.FUNCTION || request.type()==Type.EXTERNAL)) throw conflict("MENU_HAS_CHILDREN");
        if(rows.stream().anyMatch(row->(old==null || !row.id().equals(old.id())) && request.key().equals(row.key()))) throw conflict("MENU_KEY_EXISTS");
        if(rows.stream().anyMatch(row->(old==null || !row.id().equals(old.id())) && row.parentId().equals(parent) && row.name().equalsIgnoreCase(request.name()))) throw conflict("MENU_NAME_EXISTS");
        String route=nullable(request.routeId()),external=nullable(request.externalUrl());
        if(request.type()==Type.ROUTE) {
            if(external!=null) throw invalid();
            if(route==null) {if(old==null || type(old)!=Type.ROUTE || old.routeId()!=null) throw invalid();}
            else {
                var option=routes.options().stream().filter(candidate->candidate.id().equals(route)).findFirst().orElseThrow(MenuService::invalid);
                if(!Objects.equals(clean(option.permission()),clean(request.permission()))) throw invalid();
                if(rows.stream().anyMatch(row->(old==null || !row.id().equals(old.id())) && route.equals(row.routeId()))) throw conflict("MENU_ROUTE_EXISTS");
            }
        } else if(route!=null) throw invalid();
        if(request.type()==Type.EXTERNAL) {if(!safeExternal(external)) throw invalid();} else if(external!=null) throw invalid();
        if(request.type()!=Type.GROUP && nullable(request.groupPath())!=null) throw invalid();
        if(request.type()==Type.GROUP && (request.groupPath()==null || !request.groupPath().matches("[a-zA-Z0-9_-]{1,200}"))) throw invalid();
        if(request.type()==Type.GROUP && rows.stream().anyMatch(row->(old==null || !row.id().equals(old.id())) && type(row)!=Type.FUNCTION && type(row)!=Type.EXTERNAL && request.groupPath().equalsIgnoreCase(row.path()))) throw conflict("MENU_PATH_EXISTS");
        String nextPermission=clean(request.permission());
        if(!SecurityUtils.isAdmin(SecurityUtils.getUserId()) && (old==null || !nextPermission.equals(clean(old.permission())))) {
            var actor=users.selectUserById(SecurityUtils.getUserId());if(actor==null) throw denied();actor.setRoles(navigation.selectActiveRoles(actor.getUserId()));
            Set<String> grants=actor.getRoles().isEmpty()?Set.of():permissions.getMenuPermission(actor);
            if(Arrays.stream(nextPermission.split(",")).map(String::trim).filter(value->!value.isEmpty()).anyMatch(value->!grants.contains("*:*:*") && !grants.contains(value))) throw denied();
        }
    }
    private void write(Long id,MenuWriteRequest request,String path)
    {
        if(mapper.update(id,identifier(request.parentId()),request.key(),nullable(request.routeId()),request.name(),request.sort(),menuType(request.type()),request.visible()?"0":"1",request.status(),clean(request.permission()),request.type()==Type.EXTERNAL?"0":"1",path,clean(request.icon()),clean(request.remark()),clean(request.queryText()),request.cached()?"0":"1",SecurityUtils.getUsername())!=1) throw conflict("MENU_WRITE_CONFLICT");
    }
    private Set<Long> available() {return SecurityUtils.isAdmin(SecurityUtils.getUserId()) ? new HashSet<>(mapper.rows().stream().map(MenuMutationMapper.Row::id).toList()) : new HashSet<>(mapper.grantedIds(SecurityUtils.getUserId()));}
    private MenuMutationMapper.Row require(Long id,List<MenuMutationMapper.Row> rows,Set<Long> available)
    {var row=rows.stream().filter(candidate->candidate.id().equals(id)).findFirst().orElseThrow(()->new ApiFailure(404,"MENU_NOT_FOUND","Menu does not exist."));if(!available.contains(id)) throw denied();return row;}
    private MenuResponse response(MenuMutationMapper.Row row)
    {Type type=type(row);return new MenuResponse(row.id().toString(),row.parentId().toString(),row.key(),row.name(),row.sort(),type,row.status(),"0".equals(row.visible()),row.routeId(),type==Type.EXTERNAL?row.path():null,row.permission(),row.icon(),row.remark(),type==Type.GROUP?row.path():null,row.queryText(),"0".equals(row.isCache()),row.createdAt()==null?null:row.createdAt().toInstant());}
    private String path(MenuWriteRequest request,MenuMutationMapper.Row old)
    {return switch(request.type()) {case EXTERNAL -> request.externalUrl();case GROUP -> request.groupPath();case FUNCTION -> "";case ROUTE -> nullable(request.routeId())==null ? old.path() : java.net.URI.create(routes.options().stream().filter(route->route.id().equals(request.routeId())).findFirst().orElseThrow(MenuService::invalid).path()).getPath().replaceFirst("^/","");};}
    private <T>T mutate(Supplier<T> work,Set<Long> affected)
    {try {T result=transaction.execute(status->{if(mutex.lockRoot()==null) throw conflict("DEPARTMENT_ROOT_MISSING");return work.get();});sessions.refresh(affected);return result;}catch(DuplicateKeyException failure){throw conflict("MENU_IDENTITY_EXISTS");}}
    private static Type type(MenuMutationMapper.Row row) {return "F".equals(row.menuType())?Type.FUNCTION:"0".equals(row.isFrame()) || row.path()!=null && row.path().matches("(?i)^https?://.*")?Type.EXTERNAL:"M".equals(row.menuType())?Type.GROUP:Type.ROUTE;}
    private static String menuType(Type type) {return type==Type.GROUP?"M":type==Type.FUNCTION?"F":"C";}
    private static boolean safeExternal(String value) {try {URI uri=URI.create(value);return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) && uri.getHost()!=null && uri.getUserInfo()==null;}catch(IllegalArgumentException|NullPointerException failure){return false;}}
    private static String clean(String value) {return value==null?"":value;}
    private static String nullable(String value) {return value==null || value.isBlank()?null:value;}
    private static Long identifier(String value) {try {long id=Long.parseLong(value);if(id<0) throw invalid();return id;}catch(NumberFormatException failure){throw invalid();}}
    private static ApiFailure invalid() {return new ApiFailure(400,"VALIDATION_ERROR","Invalid menu request.");}
    private static ApiFailure conflict(String code) {return new ApiFailure(409,code,"Menu operation conflicts with existing data.");}
    private static AccessDeniedException denied() {return new AccessDeniedException("Menu access denied.");}
}
