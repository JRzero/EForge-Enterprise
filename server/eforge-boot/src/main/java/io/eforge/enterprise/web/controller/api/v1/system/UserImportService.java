package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.SysUserMapper;
import io.eforge.enterprise.system.service.*;

/** Import-only boundary: preserve original per-row commits and existing associations. */
@Service
public class UserImportService
{
    private final ISysUserService users;
    private final ISysDeptService departments;
    private final ISysConfigService configuration;
    private final SysUserMapper mapper;
    private final DepartmentMutationMapper mutations;
    private final Validator validator;
    private final RoleSessionRefresher sessions;
    private final TransactionTemplate transaction;
    public UserImportService(ISysUserService users, ISysDeptService departments, ISysConfigService configuration,
            SysUserMapper mapper, DepartmentMutationMapper mutations, Validator validator,
            PlatformTransactionManager transactionManager, RoleSessionRefresher sessions)
    {
        this.users = users; this.departments = departments; this.configuration = configuration;
        this.mapper = mapper; this.mutations = mutations; this.validator = validator;
        this.sessions = sessions;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public UserImportController.UserImportResponse importUsers(List<SysUser> rows, boolean updateExisting)
    {
        List<UserImportController.UserImportRow> results = new ArrayList<>(); int created = 0, updated = 0;
        Set<Long> committedUpdates = new LinkedHashSet<>();
        for (int index = 0; index < rows.size(); index++)
        {
            SysUser source = rows.get(index); String username = source == null ? null : source.getUserName();
            String outcome; String code = null;
            try
            {
                WriteResult committed = transaction.execute(status -> write(source, updateExisting));
                outcome = committed.outcome();
                if ("CREATED".equals(outcome)) created++; else updated++;
                if (committed.updatedUserId() != null) committedUpdates.add(committed.updatedUserId());
            }
            catch (ApiFailure exception) { outcome = "FAILED"; code = exception.code(); }
            catch (AccessDeniedException | ServiceException exception) { outcome = "FAILED"; code = "ACCESS_DENIED"; }
            catch (DuplicateKeyException exception) { outcome = "FAILED"; code = "USER_CONFLICT"; }
            catch (RuntimeException exception) { outcome = "FAILED"; code = "USER_IMPORT_FAILED"; }
            results.add(new UserImportController.UserImportRow(index + 1,
                    username == null ? "" : username.substring(0, Math.min(32, username.length())), outcome, code));
        }
        if (!committedUpdates.isEmpty())
        {
            // Every recorded row has already committed independently. Publish once,
            // even when other rows failed, and do not defer to an unrelated outer transaction.
            try { sessions.refresh(Set.copyOf(committedUpdates)); }
            catch (RuntimeException exception)
            {
                // A cache failure cannot turn committed SQL updates into FAILED rows.
                ApiFailure failure = new ApiFailure(503, "USER_IMPORT_SESSION_REFRESH_FAILED",
                        "Successful import rows have been saved, but existing sessions could not be synchronized. The import has not been rolled back.");
                failure.initCause(exception);
                throw failure;
            }
        }
        return new UserImportController.UserImportResponse(rows.size(), created, updated, rows.size() - created - updated, List.copyOf(results));
    }
    private record WriteResult(String outcome, Long updatedUserId) {}

    private WriteResult write(SysUser source, boolean updateExisting)
    {
        if (mutations.lockRoot() == null) throw failure(409, "DEPARTMENT_ROOT_MISSING");
        if (source == null) throw failure(400, "VALIDATION_ERROR");
        // Construct a new entity: import columns cannot supply service-owned fields.
        SysUser user = new SysUser(); user.setUserName(source.getUserName()); user.setNickName(source.getNickName());
        user.setDeptId(source.getDeptId()); user.setEmail(source.getEmail() == null ? "" : source.getEmail());
        user.setPhonenumber(source.getPhonenumber() == null ? "" : source.getPhonenumber());
        user.setSex(source.getSex() == null || source.getSex().isEmpty() ? "2" : source.getSex());
        user.setStatus(source.getStatus() == null || source.getStatus().isEmpty() ? "0" : source.getStatus());
        if (!validator.validate(user).isEmpty() || user.getUserName() == null || user.getUserName().length() < 2 || user.getUserName().length() > 20
                || !user.getPhonenumber().matches("(?:1[3-9][0-9]{9})?") || !user.getSex().matches("[012]") || !user.getStatus().matches("[01]"))
            throw failure(400, "VALIDATION_ERROR");
        SysUser existing = users.selectUserByUserName(user.getUserName());
        if (existing != null)
        {
            // Check scope before reporting an account collision to an importer.
            users.checkUserDataScope(existing.getUserId());
            if (!updateExisting) throw failure(409, "USER_USERNAME_EXISTS");
            if (existing.isAdmin()) throw failure(409, "USER_ADMIN_PROTECTED");
            users.checkUserAllowed(existing); user.setUserId(existing.getUserId());
        }
        Long requestedDepartment = user.getDeptId() == null && existing != null ? existing.getDeptId() : user.getDeptId();
        if (requestedDepartment == null)
        {
            if (!SecurityUtils.isAdmin()) throw new AccessDeniedException("An allowed department is required.");
        }
        else
        {
            if (requestedDepartment <= 0) throw failure(400, "VALIDATION_ERROR");
            departments.checkDeptDataScope(requestedDepartment);
            SysDept filter = new SysDept(); filter.setDeptId(requestedDepartment);
            SysDept department = departments.selectDeptList(filter).stream().findFirst().orElseThrow(() -> failure(409, "USER_DEPARTMENT_NOT_FOUND"));
            if (!"0".equals(department.getStatus()) && (existing == null || !requestedDepartment.equals(existing.getDeptId())))
                throw failure(409, "USER_DEPARTMENT_DISABLED");
        }
        if (!users.checkUserNameUnique(user)) throw failure(409, "USER_USERNAME_EXISTS");
        if (!user.getPhonenumber().isEmpty() && !users.checkPhoneUnique(user)) throw failure(409, "USER_PHONE_EXISTS");
        if (!user.getEmail().isEmpty() && !users.checkEmailUnique(user)) throw failure(409, "USER_EMAIL_EXISTS");
        if (existing == null)
        {
            String password = configuration.selectConfigByKey("sys.user.initPassword");
            if (password == null || password.length() < 5 || password.length() > 20 || password.matches(".*[<>\"'|\\\\].*"))
                throw failure(409, "USER_INITIAL_PASSWORD_INVALID");
            user.setPassword(SecurityUtils.encryptPassword(password)); user.setCreateBy(SecurityUtils.getUsername());
            if (mapper.insertUser(user) != 1) throw failure(409, "USER_IMPORT_FAILED");
            return new WriteResult("CREATED", null);
        }
        // Original import updates retain department, roles, posts, password, avatar
        // and remark. Only the dedicated administrative editor reassigns them.
        user.setDeptId(existing.getDeptId()); user.setUpdateBy(SecurityUtils.getUsername());
        if (mapper.updateUser(user) != 1) throw failure(404, "USER_NOT_FOUND");
        return new WriteResult("UPDATED", user.getUserId());
    }
    private static ApiFailure failure(int status, String code) { return new ApiFailure(status, code, "The import row could not be applied."); }
}
