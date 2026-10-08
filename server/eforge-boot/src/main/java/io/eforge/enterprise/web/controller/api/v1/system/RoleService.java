package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.domain.NavigationMenu;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.RoleContracts.*;

@Service
public class RoleService
{
    private final ISysRoleService roles;
    private final ISysMenuService menus;
    private final ISysDeptService departments;
    private final ISysUserService users;
    private final RoleSelectionMapper selections;
    private final DepartmentMutationMapper mutations;
    private final RoleSessionRefresher sessions;
    private final TransactionTemplate transaction;
    public RoleService(ISysRoleService roles, ISysMenuService menus, ISysDeptService departments, ISysUserService users,
            RoleSelectionMapper selections, DepartmentMutationMapper mutations, RoleSessionRefresher sessions, PlatformTransactionManager manager)
    { this.roles=roles;this.menus=menus;this.departments=departments;this.users=users;this.selections=selections;this.mutations=mutations;this.sessions=sessions;transaction=new TransactionTemplate(manager); }
    public PageResponse<RoleResponse> list(int page,int size,String name,String key,String status,String begin,String end)
    {
        SysRole filter=filter(name,key,status,begin,end);
        try { PageHelper.startPage(page,size,"r.role_sort asc,r.role_id asc"); var rows=roles.selectRoleList(filter); return new PageResponse<>(rows.stream().map(RoleResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size); }
        finally { PageHelper.clearPage(); }
    }
    public List<SysRole> export(String name,String key,String status,String begin,String end) { return roles.selectRoleList(filter(name,key,status,begin,end)); }
    public List<RoleResponse> options() { return roles.selectRoleAll().stream().map(RoleResponse::from).toList(); }
    public RoleEditorResponse get(String id)
    {
        SysRole role=require(identifier(id),false);var all=selections.menus();
        return new RoleEditorResponse(RoleResponse.from(role),keys(selections.menuIds(role.getRoleId()),all),keys(menus.selectMenuListByRoleId(role.getRoleId()),all));
    }
    public List<RoleMenuOption> menuOptions()
    {
        var all=selections.menus();var available=availableMenus(all);var rows=all.stream().filter(row->available.contains(row.menuId())).toList();
        Map<Long,String> byId=new HashMap<>();rows.forEach(row->byId.put(row.menuId(),row.menuKey()));
        return rows.stream().map(row->new RoleMenuOption(row.menuKey(),byId.get(row.parentId()),row.label(),row.menuType(),row.orderNum(),row.status(),row.perms())).toList();
    }
    public List<DepartmentResponse> departmentOptions() { return departments.selectDeptList(new SysDept()).stream().map(DepartmentResponse::from).toList(); }
    public RoleScopeResponse scope(String id)
    {
        SysRole role=require(identifier(id),false);
        return new RoleScopeResponse(role.getDataScope(),role.isDeptCheckStrictly(),strings(selections.departmentIds(role.getRoleId())),strings(departments.selectDeptListByRoleId(role.getRoleId())),departmentOptions());
    }
    public RoleResponse create(RoleWriteRequest request)
    {
        return mutate(()-> {
            SysRole role=write(request,null);role.setCreateBy(SecurityUtils.getUsername());unique(role);roles.insertRole(role);return RoleResponse.from(role);
        },new HashSet<>());
    }
    public void update(String id,RoleWriteRequest request)
    {
        Set<Long> affected=new HashSet<>();mutate(()-> {
            SysRole existing=require(identifier(id),true);affected.addAll(selections.userIds(existing.getRoleId()));
            SysRole patch=write(request,existing);patch.setUpdateBy(SecurityUtils.getUsername());unique(patch);roles.updateRole(patch);return null;
        },affected);
    }
    public void status(String id,String value)
    {
        Set<Long> affected=new HashSet<>();mutate(()-> {
            SysRole existing=require(identifier(id),true);affected.addAll(selections.userIds(existing.getRoleId()));
            SysRole patch=new SysRole(existing.getRoleId());patch.setStatus(value);preserveFlags(patch,existing);patch.setUpdateBy(SecurityUtils.getUsername());
            if(roles.updateRoleStatus(patch)!=1) throw conflict("ROLE_WRITE_CONFLICT");return null;
        },affected);
    }
    public void scope(String id,RoleScopeRequest request)
    {
        Set<Long> affected=new HashSet<>();mutate(()-> {
            SysRole existing=require(identifier(id),true);affected.addAll(selections.userIds(existing.getRoleId()));
            Long[] ids=identifiers(request.departmentIds());
            if(!"2".equals(request.mode()) && ids.length>0) throw invalid();
            for(Long departmentId:ids)
            {
                try { departments.checkDeptDataScope(departmentId); } catch(ServiceException exception) { throw denied(); }
                SysDept filter=new SysDept();filter.setDeptId(departmentId);
                if(departments.selectDeptList(filter).isEmpty()) throw new ApiFailure(404,"ROLE_DEPARTMENT_NOT_FOUND","Department does not exist.");
            }
            SysRole patch=new SysRole(existing.getRoleId());patch.setDataScope(request.mode());patch.setDeptIds(ids);
            patch.setMenuCheckStrictly(existing.isMenuCheckStrictly());patch.setDeptCheckStrictly(request.departmentLinked());patch.setUpdateBy(SecurityUtils.getUsername());
            roles.authDataScope(patch);return null;
        },affected);
    }
    public void delete(DeleteRolesRequest request)
    {
        mutate(()-> {
            Long[] ids=identifiers(request.ids());for(Long id:ids) { require(id,true);if(roles.countUserRoleByRoleId(id)>0) throw conflict("ROLE_IN_USE"); }
            roles.deleteRoleByIds(ids);return null;
        },new HashSet<>());
    }
    public PageResponse<UserContracts.UserResponse> users(String id,boolean assigned,int page,int size,String username,String phone)
    {
        SysRole role=require(identifier(id),false);SysUser filter=new SysUser();filter.setRoleId(role.getRoleId());filter.setUserName(username);filter.setPhonenumber(phone);
        try { PageHelper.startPage(page,size,"u.user_id asc");var rows=assigned ? users.selectAllocatedList(filter) : users.selectUnallocatedList(filter);return new PageResponse<>(rows.stream().map(UserContracts.UserResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size); }
        finally { PageHelper.clearPage(); }
    }
    public void users(String id,RoleUsersRequest request,boolean assign)
    {
        Set<Long> affected=new HashSet<>();mutate(()-> {
            SysRole role=require(identifier(id),true);Long[] ids=identifiers(request.userIds());
            Set<Long> current=new HashSet<>(selections.userIds(role.getRoleId()));List<Long> changes=new ArrayList<>();
            for(Long userId:ids)
            {
                try { users.checkUserDataScope(userId); } catch(ServiceException exception) { throw denied(); }
                SysUser user=users.selectUserById(userId);
                if(user==null || !"0".equals(user.getDelFlag())) throw new ApiFailure(404,"USER_NOT_FOUND","User does not exist.");
                if(user.isAdmin()) throw conflict("USER_ADMIN_PROTECTED");users.checkUserAllowed(user);
                if(assign && !current.contains(userId)) { if(!"0".equals(role.getStatus())) throw conflict("ROLE_DISABLED");changes.add(userId); }
                if(!assign && current.contains(userId)) changes.add(userId);
                affected.add(userId);
            }
            if(!changes.isEmpty()) { Long[] changed=changes.toArray(Long[]::new);if(assign) roles.insertAuthUsers(role.getRoleId(),changed);else roles.deleteAuthUsers(role.getRoleId(),changed); }
            return null;
        },affected);
    }
    private SysRole write(RoleWriteRequest request,SysRole existing)
    {
        Set<String> requested=new LinkedHashSet<>(request.menuKeys());if(requested.size()!=request.menuKeys().size()) throw invalid();
        var all=selections.menus();var grants=menuGrantScope(existing,all);
        Map<String,Long> byKey=new HashMap<>();all.forEach(row->byKey.put(row.menuKey(),row.menuId()));List<Long> menuIds=new ArrayList<>();
        for(String key:requested) { Long menuId=byKey.get(key);grants.validate(menuId);menuIds.add(menuId); }
        SysRole role=new SysRole(existing==null ? null : existing.getRoleId());role.setRoleName(request.name());role.setRoleKey(request.key());role.setRoleSort(request.sort());role.setStatus(request.status());role.setRemark(Objects.toString(request.remark(),""));
        role.setMenuCheckStrictly(request.menuLinked());role.setDeptCheckStrictly(existing==null || existing.isDeptCheckStrictly());role.setDataScope(existing==null ? "1" : existing.getDataScope());role.setMenuIds(menuIds.toArray(Long[]::new));return role;
    }

    /** Called inside the compatibility writer's shared root-lock transaction. */
    public Long[] validateLegacyMenuGrants(Long[] menuIds,Long existingRoleId)
    {
        // Prior grants belong only to a persisted, scoped, mutable target. A create
        // caller supplies null and cannot borrow another role's unavailable grants.
        SysRole existing=existingRoleId==null ? null : require(identifier(existingRoleId.toString()),true);
        return validateMenuGrants(menuIds,existing,selections.menus());
    }

    private Long[] validateMenuGrants(Long[] menuIds,SysRole existing,List<NavigationMenu> all)
    {
        if(menuIds==null || menuIds.length>2000
                || Arrays.stream(menuIds).anyMatch(id->id==null || id<1)
                || new HashSet<>(Arrays.asList(menuIds)).size()!=menuIds.length) throw invalid();
        var grants=menuGrantScope(existing,all);
        // Validate the entire set before an imported service can delete/reinsert links.
        for(Long menuId:menuIds) grants.validate(menuId);
        return menuIds.clone();
    }

    private MenuGrantScope menuGrantScope(SysRole existing,List<NavigationMenu> all)
    {
        Set<Long> known=new HashSet<>();all.forEach(row->known.add(row.menuId()));
        Set<Long> available=availableMenus(all);
        Set<Long> previous=existing==null ? Set.of() : new HashSet<>(selections.menuIds(existing.getRoleId()));
        return new MenuGrantScope(known,available,previous);
    }

    private record MenuGrantScope(Set<Long> known,Set<Long> available,Set<Long> previous)
    {
        void validate(Long menuId)
        {
            if(menuId==null || !known.contains(menuId)) throw new ApiFailure(404,"ROLE_MENU_NOT_FOUND","Menu does not exist.");
            if(!available.contains(menuId) && !previous.contains(menuId)) throw denied();
        }
    }
    private void preserveFlags(SysRole patch,SysRole existing) { patch.setMenuCheckStrictly(existing.isMenuCheckStrictly());patch.setDeptCheckStrictly(existing.isDeptCheckStrictly()); }
    private Set<Long> availableMenus(List<NavigationMenu> all)
    {
        Long userId=SecurityUtils.getUserId();
        if(!SecurityUtils.isAdmin(userId)) return new HashSet<>(selections.grantableMenuIds(userId));
        Set<Long> ids=new HashSet<>();all.forEach(menu->ids.add(menu.menuId()));return ids;
    }
    private SysRole require(Long id,boolean mutable)
    {
        try { roles.checkRoleDataScope(id); } catch(ServiceException exception) { throw denied(); }
        SysRole role=roles.selectRoleById(id);if(role==null || !"0".equals(role.getDelFlag())) throw new ApiFailure(404,"ROLE_NOT_FOUND","Role does not exist.");
        if(mutable) { if(role.isAdmin()) throw conflict("ROLE_ADMIN_PROTECTED");roles.checkRoleAllowed(role); }return role;
    }
    private void unique(SysRole role) { if(!roles.checkRoleNameUnique(role)) throw conflict("ROLE_NAME_EXISTS");if(!roles.checkRoleKeyUnique(role)) throw conflict("ROLE_KEY_EXISTS"); }
    private <T> T mutate(Supplier<T> action,Set<Long> affected)
    {
        T result;
        try { result=transaction.execute(status->{if(mutations.lockRoot()==null) throw conflict("DEPARTMENT_ROOT_MISSING");return action.get();}); }
        catch(DuplicateKeyException exception) { throw conflict("ROLE_CONFLICT"); }
        sessions.refresh(affected);return result;
    }
    private static List<String> keys(List<Long> ids,List<NavigationMenu> rows) { Set<Long> selected=new HashSet<>(ids);return rows.stream().filter(row->selected.contains(row.menuId())).map(NavigationMenu::menuKey).toList(); }
    private static List<String> strings(List<Long> ids) { return ids.stream().map(Object::toString).toList(); }
    private static Long identifier(String value) { try { long id=Long.parseLong(value);if(id<1) throw invalid();return id; } catch(NumberFormatException exception) { throw invalid(); } }
    private static Long[] identifiers(List<String> values) { var ids=values.stream().map(RoleService::identifier).toList();if(new HashSet<>(ids).size()!=ids.size()) throw invalid();return ids.toArray(Long[]::new); }
    private static AccessDeniedException denied() { return new AccessDeniedException("Object is outside the allowed scope."); }
    private static ApiFailure invalid() { return new ApiFailure(400,"VALIDATION_ERROR","The role request is invalid."); }
    private static ApiFailure conflict(String code) { return new ApiFailure(409,code,"The role operation conflicts with the current state."); }
    private static SysRole filter(String name,String key,String status,String begin,String end)
    {
        try { LocalDate first=begin.isBlank() ? null : LocalDate.parse(begin);LocalDate last=end.isBlank() ? null : LocalDate.parse(end);if(first!=null && last!=null && first.isAfter(last)) throw invalid(); }
        catch(java.time.format.DateTimeParseException exception) { throw invalid(); }
        SysRole role=new SysRole();role.setRoleName(name);role.setRoleKey(key);role.setStatus(status);if(!begin.isBlank()) role.getParams().put("beginTime",begin);if(!end.isBlank()) role.getParams().put("endTime",end);return role;
    }
}
