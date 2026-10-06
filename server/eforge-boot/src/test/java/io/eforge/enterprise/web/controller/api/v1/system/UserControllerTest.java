package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes = {UserController.class, UserImportController.class, PermissionService.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, UserControllerTest.Configuration.class})
class UserControllerTest
{
    private static final String PATH = "/api/v1/system/users";
    private static final String USER = "{\"username\":\"member\",\"displayName\":\"Member\",\"departmentId\":\"103\",\"sex\":\"2\",\"status\":\"0\",\"roleIds\":[],\"postIds\":[]}";
    private static final String CREATE = "{\"user\":" + USER + ",\"password\":\"Test12345\"}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysUserService users;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysPostService posts;
    @MockitoBean ISysConfigService configuration;
    @MockitoBean UserImportService importer;
    @MockitoBean io.eforge.enterprise.system.mapper.DepartmentMutationMapper mutations;
    @MockitoBean TokenService tokens;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void authenticate()
    {
        SysUser admin = row(1); admin.setUserName("admin");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(1L, 103L, admin, Set.of("*:*:*")));
        when(mutations.lockRoot()).thenReturn(100L);
        when(users.selectUserById(anyLong())).thenAnswer(invocation -> {
            long id = invocation.getArgument(0); return id == 999 ? null : row(id);
        });
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.checkPhoneUnique(any())).thenReturn(true);
        when(users.checkEmailUnique(any())).thenReturn(true);
        SysDept department = new SysDept(); department.setDeptId(103L); department.setParentId(101L);
        department.setDeptName("Engineering"); department.setOrderNum(1); department.setStatus("0"); department.setDelFlag("0");
        when(departments.selectDeptById(103L)).thenReturn(department);
        when(departments.selectDeptList(any())).thenReturn(List.of(department));
        when(users.selectUserList(any())).thenReturn(List.of(row(2)));
        when(roles.selectRoleListByUserId(anyLong())).thenReturn(List.of(2L));
        when(posts.selectPostListByUserId(anyLong())).thenReturn(List.of(1L));
        when(roles.selectRoleAll()).thenReturn(List.of());
        when(posts.selectPostAll()).thenReturn(List.of());
        when(configuration.selectConfigByKey(anyString())).thenReturn("Test12345");
    }
    @Test void roleAssignmentWaitsForCommitAndRollbackNeverRefreshes() throws Exception
    {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try
        {
            mvc.perform(put(PATH + "/2/roles").contentType(MediaType.APPLICATION_JSON).content("{\"roleIds\":[]}"))
                    .andExpect(status().isNoContent());
            verifyNoInteractions(sessions);
            var callbacks = org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations();
            org.junit.jupiter.api.Assertions.assertEquals(1, callbacks.size());
            callbacks.forEach(callback -> callback.afterCompletion(
                    org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK));
            verifyNoInteractions(sessions);
        }
        finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try
        {
            mvc.perform(put(PATH + "/2/roles").contentType(MediaType.APPLICATION_JSON).content("{\"roleIds\":[]}"))
                    .andExpect(status().isNoContent());
            verifyNoInteractions(sessions);
            org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
            verify(sessions).refresh(Set.of(2L));
        }
        finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
    }
    private static SysUser row(long id)
    {
        SysUser user = new SysUser(id); user.setDeptId(103L); user.setUserName("member"); user.setNickName("Member");
        user.setStatus("0"); user.setDelFlag("0"); user.setPassword("sensitive-hash");
        user.setEmail("old@example.com"); user.setPhonenumber("13800138000"); return user;
    }
    @Test void listAndDetailsNeverExposeCredentialsOrServiceInternals() throws Exception
    {
        mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("2"))
                .andExpect(jsonPath("$.items[0].password").doesNotExist()).andExpect(jsonPath("$.items[0].roles").doesNotExist())
                .andExpect(jsonPath("$.items[0].params").doesNotExist()).andExpect(jsonPath("$.pageSize").value(10));
        mvc.perform(get(PATH + "/2")).andExpect(status().isOk()).andExpect(jsonPath("$.roleIds[0]").value("2"))
                .andExpect(jsonPath("$.postIds[0]").value("1")).andExpect(jsonPath("$.user.password").doesNotExist());
    }
    @Test void departmentOptionsWorkWithOnlyUserListPermission() throws Exception
    {
        SysUser account = row(2);
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L, 103L, account, Set.of("system:user:list")));
        mvc.perform(get(PATH + "/departments")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value("103"));
        mvc.perform(get(PATH + "/options")).andExpect(status().isForbidden());
    }
    @ParameterizedTest @ValueSource(strings = {"page=0", "pageSize=101", "beginDate=2026-02-30", "beginDate=2026-10-04&endDate=2026-01-01", "departmentId=9223372036854775808"})
    void invalidListQueriesAreRejected(String query) throws Exception
    {
        mvc.perform(get(PATH + "?" + query)).andExpect(status().isBadRequest());
        verify(users, never()).selectUserList(any());
    }
    @Test void scopedFilterPreservesDateAndDepartmentContracts() throws Exception
    {
        mvc.perform(get(PATH).param("username", "mem").param("departmentId", "103").param("beginDate", "2026-01-01").param("endDate", "2026-10-04"))
                .andExpect(status().isOk());
        verify(users).selectUserList(argThat(user -> user.getDeptId().equals(103L) && "mem".equals(user.getUserName())
                && "2026-01-01".equals(user.getParams().get("beginTime"))));
    }
    @Test void createHashesPasswordAndReturnsExactStringIdAndLocation() throws Exception
    {
        when(users.insertUser(any())).thenAnswer(invocation -> { SysUser user = invocation.getArgument(0); user.setUserId(9007199254740993L); return 1; });
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isCreated())
                .andExpect(header().string("Location", PATH + "/9007199254740993"))
                .andExpect(jsonPath("$.id").value("9007199254740993")).andExpect(jsonPath("$.password").doesNotExist());
        verify(users).insertUser(argThat(user -> SecurityUtils.matchesPassword("Test12345", user.getPassword())
                && "admin".equals(user.getCreateBy()) && user.getRoleIds().length == 0));
    }
    @ParameterizedTest @ValueSource(strings = {"{}", "null", "{\"user\":null,\"password\":\"abcde\"}", "{\"user\":{},\"password\":\"short\"}"})
    void invalidCreateBodiesNeverWrite(String body) throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verify(users, never()).insertUser(any());
    }
    @Test void forbiddenDepartmentAndRoleNeverWrite() throws Exception
    {
        doThrow(new ServiceException("private-scope-detail")).when(departments).checkDeptDataScope(103L);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isForbidden())
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-scope-detail"))));
        verify(users, never()).insertUser(any());
        reset(departments);
        SysDept dept = new SysDept(); dept.setDeptId(103L); dept.setDelFlag("0"); dept.setStatus("0");
        when(departments.selectDeptById(103L)).thenReturn(dept);
        when(departments.selectDeptList(any())).thenReturn(List.of(dept));
        doThrow(new ServiceException("private-role-detail")).when(roles).checkRoleDataScope(any());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE.replace("\"roleIds\":[]", "\"roleIds\":[\"2\"]"))).andExpect(status().isForbidden());
        verify(users, never()).insertUser(any());
    }
    @Test void serviceOwnedFieldsCannotBeMassAssignedAndOriginalScriptValidationRemains() throws Exception
    {
        when(users.insertUser(any())).thenAnswer(invocation -> { SysUser user = invocation.getArgument(0); user.setUserId(10L); return 1; });
        String forged = CREATE.replace("\"username\":\"member\"", "\"username\":\"member\",\"userId\":\"1\",\"delFlag\":\"2\",\"createBy\":\"attacker\",\"params\":{\"dataScope\":\" OR 1=1\"}");
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(forged)).andExpect(status().isCreated());
        verify(users).insertUser(argThat(user -> user.getUserId().equals(10L) && "admin".equals(user.getCreateBy())
                && !user.getParams().containsKey("dataScope") && user.getDelFlag() == null));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE.replace("Member", "<script>")))
                .andExpect(status().isBadRequest());
    }
    @Test void duplicatesAreSafeConflicts() throws Exception
    {
        when(users.checkUserNameUnique(any())).thenReturn(false);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_USERNAME_EXISTS"));
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.insertUser(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("private-sql"));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_CONFLICT"));
    }
    @Test void updateClearsContactsAndDoesNotChangePasswordOrUsername() throws Exception
    {
        when(users.updateUser(any())).thenReturn(1);
        mvc.perform(put(PATH + "/2").contentType(MediaType.APPLICATION_JSON).content(USER)).andExpect(status().isOk());
        verify(users).updateUser(argThat(user -> "".equals(user.getEmail()) && "".equals(user.getPhonenumber()) && user.getPassword() == null));
        mvc.perform(put(PATH + "/2").contentType(MediaType.APPLICATION_JSON).content(USER.replace("member", "renamed"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_USERNAME_IMMUTABLE"));
    }
    @Test void adminSelfDeleteAndMissingUsersAreProtected() throws Exception
    {
        mvc.perform(put(PATH + "/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"1\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_ADMIN_PROTECTED"));
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_SELF_DELETE"));
        mvc.perform(get(PATH + "/999")).andExpect(status().isNotFound());
        verify(users, never()).updateUserStatus(any()); verify(users, never()).deleteUserByIds(any());
    }
    @Test void batchDeletionPrechecksAllUsersBeforeAnyWrite() throws Exception
    {
        doThrow(new ServiceException("out of scope")).when(users).checkUserDataScope(3L);
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\",\"3\"]}"))
                .andExpect(status().isForbidden());
        verify(users, never()).deleteUserByIds(any());
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\",\"2\"]}"))
                .andExpect(status().isBadRequest());
    }
    @Test void passwordAndStatusUseSeparateTypedOperations() throws Exception
    {
        when(users.resetPwd(any())).thenReturn(1); when(users.updateUserStatus(any())).thenReturn(1);
        mvc.perform(put(PATH + "/2/password").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"New12345\"}"))
                .andExpect(status().isNoContent());
        verify(users).resetPwd(argThat(user -> SecurityUtils.matchesPassword("New12345", user.getPassword())));
        mvc.perform(put(PATH + "/2/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"1\"}"))
                .andExpect(status().isNoContent());
    }
    @Test void unchangedDisabledAssociationsAreRetainedButCannotBeNewlyAssigned() throws Exception
    {
        SysRole role = new SysRole(2L); role.setDelFlag("0"); role.setStatus("1");
        when(roles.selectRoleById(2L)).thenReturn(role);
        var post = new io.eforge.enterprise.system.domain.SysPost(); post.setPostId(1L); post.setStatus("1");
        when(posts.selectPostById(1L)).thenReturn(post);
        when(users.updateUser(any())).thenReturn(1);
        String body = USER.replace("\"roleIds\":[]", "\"roleIds\":[\"2\"]").replace("\"postIds\":[]", "\"postIds\":[\"1\"]");
        mvc.perform(put(PATH + "/2").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"user\":" + body + ",\"password\":\"Test12345\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_ROLE_DISABLED"));
        verify(users, never()).insertUser(any());
    }
    @Test void roleAssignmentRejectsSuperAdminAndChecksTargetScope() throws Exception
    {
        SysRole adminRole = new SysRole(1L); adminRole.setDelFlag("0"); adminRole.setStatus("0");
        when(roles.selectRoleById(1L)).thenReturn(adminRole);
        mvc.perform(put(PATH + "/2/roles").contentType(MediaType.APPLICATION_JSON).content("{\"roleIds\":[\"1\"]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_ADMIN_ROLE_PROTECTED"));
        doThrow(new ServiceException("out of scope")).when(users).checkUserDataScope(2L);
        mvc.perform(get(PATH + "/2/roles")).andExpect(status().isForbidden());
        verify(users, never()).insertUserAuth(anyLong(), any());
    }
    @Test void allOperationsRequireTheirBackendPermissions() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L, 103L, row(2), Set.of()));
        mvc.perform(get(PATH)).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/departments")).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/options")).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/2")).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/2/roles")).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/2").contentType(MediaType.APPLICATION_JSON).content(USER)).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/2/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"1\"}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/2/password").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"New12345\"}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/2/roles").contentType(MediaType.APPLICATION_JSON).content("{\"roleIds\":[]}")).andExpect(status().isForbidden());
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\"]}")).andExpect(status().isForbidden());
        mvc.perform(post(PATH + "/export")).andExpect(status().isForbidden());
        mvc.perform(post(PATH + "/import-template")).andExpect(status().isForbidden());
        mvc.perform(multipart(PATH + "/import").file(new org.springframework.mock.web.MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[]{1}))).andExpect(status().isForbidden());
        verify(users, never()).selectUserById(any()); verify(users, never()).selectUserList(any());
        verifyNoInteractions(mutations);
    }
    private byte[] workbook(boolean legacy, int lastRow) throws Exception
    {
        try (org.apache.poi.ss.usermodel.Workbook workbook = legacy ? new org.apache.poi.hssf.usermodel.HSSFWorkbook() : new org.apache.poi.xssf.usermodel.XSSFWorkbook();
                var output = new java.io.ByteArrayOutputStream())
        {
            var sheet = workbook.createSheet("Users"); var header = sheet.createRow(0);
            String[] columns = {"部门编号", "登录名称", "用户名称", "用户性别", "账号状态", "用户序号", "password"};
            for (int index = 0; index < columns.length; index++) header.createCell(index).setCellValue(columns[index]);
            var row = sheet.createRow(lastRow); row.createCell(0).setCellValue(103); row.createCell(1).setCellValue("imported");
            row.createCell(2).setCellValue("Imported"); row.createCell(3).setCellValue("未知"); row.createCell(4).setCellValue("正常");
            row.createCell(5).setCellValue(1); row.createCell(6).setCellValue("forged"); workbook.write(output); return output.toByteArray();
        }
    }
    @org.junit.jupiter.params.ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void importsBothRealWorkbookFormatsWithOriginalConvertersAndNoInternalFields(boolean legacy) throws Exception
    {
        SysUser account = row(2);
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L, 103L, account, Set.of("system:user:import")));
        when(importer.importUsers(any(), eq(true))).thenReturn(new UserImportController.UserImportResponse(1, 1, 0, 0,
                List.of(new UserImportController.UserImportRow(1, "imported", "CREATED", null))));
        var file = new org.springframework.mock.web.MockMultipartFile("file", legacy ? "users.xls" : "users.xlsx", "application/octet-stream", workbook(legacy, 1));
        mvc.perform(multipart(PATH + "/import").file(file).param("updateExisting", "true")).andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1)).andExpect(jsonPath("$.rows[0].outcome").value("CREATED"));
        verify(importer).importUsers(argThat(rows -> rows.size() == 1 && "imported".equals(rows.get(0).getUserName())
                && rows.get(0).getDeptId().equals(103L) && "2".equals(rows.get(0).getSex()) && "0".equals(rows.get(0).getStatus())
                && rows.get(0).getUserId() == null && rows.get(0).getPassword() == null), eq(true));
    }
    @Test void corruptUnsupportedAndOversizedWorkbooksReturnSafeProblemsBeforeImport() throws Exception
    {
        mvc.perform(multipart(PATH + "/import").file(new org.springframework.mock.web.MockMultipartFile("file", "broken.xlsx", "application/octet-stream", new byte[]{1,2,3})))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("USER_IMPORT_FILE_INVALID"));
        mvc.perform(multipart(PATH + "/import").file(new org.springframework.mock.web.MockMultipartFile("file", "users.csv", "application/octet-stream", workbook(false, 1))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("USER_IMPORT_FILE_INVALID"));
        mvc.perform(multipart(PATH + "/import").file(new org.springframework.mock.web.MockMultipartFile("file", "large.xlsx", "application/octet-stream", workbook(false, 1001))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("USER_IMPORT_TOO_LARGE"));
        verifyNoInteractions(importer);
    }
    @Test void importTemplateContainsOriginalImportColumnsAndNoCredentialColumn() throws Exception
    {
        var response = mvc.perform(post(PATH + "/import-template")).andExpect(status().isOk()).andReturn().getResponse();
        try (var input = new java.io.ByteArrayInputStream(response.getContentAsByteArray()); var workbook = org.apache.poi.ss.usermodel.WorkbookFactory.create(input))
        {
            var columns = new java.util.ArrayList<String>();
            for (var cell : workbook.getSheetAt(0).getRow(0)) columns.add(cell.getStringCellValue());
            org.junit.jupiter.api.Assertions.assertTrue(columns.containsAll(List.of("部门编号", "登录名称", "用户名称", "用户性别", "账号状态")));
            org.junit.jupiter.api.Assertions.assertFalse(columns.contains("password"));
        }
    }
    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
