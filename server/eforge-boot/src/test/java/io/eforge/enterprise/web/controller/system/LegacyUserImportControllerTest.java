package io.eforge.enterprise.web.controller.system;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.security.handle.AuthenticationEntryPointImpl;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.ApiRoutingExceptionResolver;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.SysUserMapper;
import io.eforge.enterprise.system.service.ISysConfigService;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysPostService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportController;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportFileReader;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportService;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Both multipart HTTP contracts execute the same importer; no legacy row writer is mocked into success. */
@WebMvcTest
@ContextConfiguration(classes = {SysUserController.class, UserImportController.class, UserImportService.class, UserImportFileReader.class,
        PermissionService.class, GlobalExceptionHandler.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class,
        ApiSecurityProblemHandler.class, AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class,
        LegacyUserImportControllerTest.Configuration.class})
class LegacyUserImportControllerTest
{
    private static final String LEGACY = "/system/user/importData";
    private static final String CANONICAL = "/api/v1/system/users/import";
    @Autowired MockMvc mvc;
    @MockitoBean ISysUserService users;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysPostService posts;
    @MockitoBean ISysConfigService configuration;
    @MockitoBean SysUserMapper mapper;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;

    @BeforeEach
    void prepare()
    {
        actor(Set.of("system:user:import"));
        when(transactions.getTransaction(any())).thenAnswer(call -> {
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW,
                    call.<TransactionDefinition>getArgument(0).getPropagationBehavior());
            return new SimpleTransactionStatus();
        });
        when(mutations.lockRoot()).thenReturn(100L);
        SysDept department = new SysDept();
        department.setDeptId(103L);
        department.setStatus("0");
        when(departments.selectDeptList(any())).thenReturn(List.of(department));
        when(configuration.selectConfigByKey(any())).thenReturn("Import12345");
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.checkPhoneUnique(any())).thenReturn(true);
        when(users.checkEmailUnique(any())).thenReturn(true);
        SysUser existing = new SysUser(2L);
        existing.setUserName("member");
        existing.setDeptId(105L);
        when(users.selectUserByUserName("member")).thenReturn(existing);
        when(mapper.insertUser(any())).thenReturn(1);
        when(mapper.updateUser(any())).thenReturn(1);
    }

    @Test
    void legacySuccessfulImportUsesCanonicalWritesAndRefreshesCommittedUpdates() throws Exception
    {
        mvc.perform(multipart(LEGACY).file(workbook("member", "newaccount")).param("updateSupport", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.msg").value(containsString("新增 1 条，更新 1 条，失败 0 条")));

        var order = inOrder(mapper, transactions, sessions);
        order.verify(mapper).updateUser(argThat(user -> user.getUserId().equals(2L)
                && user.getDeptId().equals(105L) && "1".equals(user.getStatus())
                && user.getRoleIds() == null && user.getPostIds() == null && user.getPassword() == null));
        order.verify(transactions).commit(any());
        order.verify(mapper).insertUser(any());
        order.verify(transactions).commit(any());
        order.verify(sessions).refresh(Set.of(2L));
        verify(users, never()).importUser(any(), anyBoolean(), anyString());
    }

    @Test
    void legacyPartialFailureStillRefreshesSuccessAndEscapesItsSummary() throws Exception
    {
        mvc.perform(multipart(LEGACY).file(workbook("member", "<script>")).param("updateSupport", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value(containsString("更新 1 条，失败 1 条")))
                .andExpect(jsonPath("$.msg").value(containsString("成功条目已保存")))
                .andExpect(jsonPath("$.msg").value(containsString("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.msg").value(containsString("&lt;script&gt;")))
                .andExpect(jsonPath("$.msg").value(not(containsString("<script>"))));

        var order = inOrder(mapper, transactions, sessions);
        order.verify(mapper).updateUser(any());
        order.verify(transactions).commit(any());
        order.verify(transactions).rollback(any());
        order.verify(sessions).refresh(Set.of(2L));
        verify(users, never()).importUser(any(), anyBoolean(), anyString());
    }

    @Test
    void canonicalPartialFailureKeepsItsTypedCommittedRowResult() throws Exception
    {
        mvc.perform(multipart(CANONICAL).file(workbook("member", "<script>")).param("updateExisting", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(1))
                .andExpect(jsonPath("$.failed").value(1)).andExpect(jsonPath("$.rows[0].outcome").value("UPDATED"))
                .andExpect(jsonPath("$.rows[1].outcome").value("FAILED"))
                .andExpect(jsonPath("$.rows[1].code").value("VALIDATION_ERROR"));
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void legacyRefreshFailureIsSeparateFromSqlFailure() throws Exception
    {
        doThrow(new DataAccessResourceFailureException("private Redis credentials"))
                .when(sessions).refresh(Set.of(2L));

        mvc.perform(multipart(LEGACY).file(workbook("member")).param("updateSupport", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(503))
                .andExpect(jsonPath("$.msg").value(containsString("成功条目已保存")))
                .andExpect(jsonPath("$.msg").value(containsString("会话同步失败")))
                .andExpect(jsonPath("$.msg").value(containsString("未回滚")))
                .andExpect(jsonPath("$.msg").value(not(containsString("private"))));

        verify(transactions).commit(any());
        verify(transactions, never()).rollback(any());
        verify(mapper).updateUser(any());
    }

    @Test
    void canonicalRefreshFailureUsesA503ProblemWithoutClaimingARowRollback() throws Exception
    {
        doThrow(new DataAccessResourceFailureException("private Redis credentials"))
                .when(sessions).refresh(Set.of(2L));

        mvc.perform(multipart(CANONICAL).file(workbook("member")).param("updateExisting", "true"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("USER_IMPORT_SESSION_REFRESH_FAILED"))
                .andExpect(jsonPath("$.detail").value(containsString("have been saved")))
                .andExpect(jsonPath("$.detail").value(not(containsString("private"))))
                .andExpect(jsonPath("$.rows").doesNotExist());

        verify(transactions).commit(any());
        verify(transactions, never()).rollback(any());
    }

    @Test
    void sqlFailureDoesNotRefreshOrExposeRawExceptionDetails() throws Exception
    {
        when(mapper.updateUser(any())).thenThrow(new DataAccessResourceFailureException("private SQL credentials"));

        mvc.perform(multipart(LEGACY).file(workbook("member")).param("updateSupport", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value(containsString("更新 0 条，失败 1 条")))
                .andExpect(jsonPath("$.msg").value(containsString("USER_IMPORT_FAILED")))
                .andExpect(jsonPath("$.msg").value(not(containsString("private"))));

        verify(transactions).rollback(any());
        verifyNoInteractions(sessions);
    }

    @Test
    void bothImportContractsStillRequireTheImportGrant() throws Exception
    {
        actor(Set.of("system:user:edit"));
        mvc.perform(multipart(LEGACY).file(workbook("member")).param("updateSupport", "true"))
                .andExpect(jsonPath("$.code").value(403));
        mvc.perform(multipart(CANONICAL).file(workbook("member")).param("updateExisting", "true"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper, sessions, mutations);
    }

    @Test
    void legacyEmptyWorkbookRetainsItsValidationFailure() throws Exception
    {
        mvc.perform(multipart(LEGACY).file(workbook()).param("updateSupport", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value("导入用户数据不能为空！"));
        verifyNoInteractions(mapper, sessions, mutations);
    }

    @ParameterizedTest @MethodSource("invalidUploads")
    void bothFileBoundariesRejectBeforeAnyRowTransaction(String path, String kind, String code) throws Exception
    {
        MockMultipartFile file = switch (kind)
        {
            case "extension" -> new MockMultipartFile("file", "users.txt", "application/octet-stream", workbook("member").getBytes());
            case "disguise" -> new MockMultipartFile("file", "users.xls", "application/vnd.ms-excel", workbook("member").getBytes());
            case "corrupt" -> new MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[] {1, 2, 3});
            case "zero" -> new MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[0]);
            case "header" -> modifiedWorkbook(1, false);
            default -> modifiedWorkbook(1001, true);
        };
        var result = mvc.perform(multipart(path).file(file).param("updateSupport", "true").param("updateExisting", "true"));
        if (CANONICAL.equals(path)) result.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(code));
        else result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("USER_IMPORT_TOO_LARGE".equals(code)
                        ? "用户工作簿最多包含 1000 行数据。" : "请上传有效的 XLS 或 XLSX 用户工作簿。"));
        verifyNoInteractions(mapper, sessions, mutations, transactions);
    }

    static Stream<Arguments> invalidUploads()
    {
        return Stream.of(LEGACY, CANONICAL).flatMap(path -> Stream.of("extension", "disguise", "corrupt", "zero", "header", "rows")
                .map(kind -> Arguments.of(path, kind, "rows".equals(kind) ? "USER_IMPORT_TOO_LARGE" : "USER_IMPORT_FILE_INVALID")));
    }

    @ParameterizedTest @ValueSource(strings = {LEGACY, CANONICAL})
    void thousandthPhysicalDataRowIsAcceptedThroughBothContracts(String path) throws Exception
    {
        var result = mvc.perform(multipart(path).file(modifiedWorkbook(1000, true))
                .param("updateSupport", "true").param("updateExisting", "true"));
        result.andExpect(status().isOk());
        if (CANONICAL.equals(path)) result.andExpect(jsonPath("$.updated").value(1)).andExpect(jsonPath("$.total").value(1));
        else result.andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.msg").value(containsString("更新 1 条")));
        verify(mapper).updateUser(any());
        verify(transactions).commit(any());
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void absentPartsAndEmptyDataKeepTheirControlledContractSpecificErrors() throws Exception
    {
        mvc.perform(multipart(LEGACY)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("请上传有效的 XLS 或 XLSX 用户工作簿。"));
        mvc.perform(multipart(CANONICAL)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(multipart(CANONICAL).file(workbook())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_IMPORT_EMPTY"));
        verifyNoInteractions(mapper, sessions, mutations, transactions);
    }

    private static MockMultipartFile modifiedWorkbook(int rowIndex, boolean usernameHeader) throws Exception
    {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(workbook("member").getBytes()));
                var output = new ByteArrayOutputStream())
        {
            var sheet = workbook.getSheetAt(0);
            if (!usernameHeader) sheet.getRow(0).getCell(1).setCellValue("Not a username column");
            if (rowIndex != 1) sheet.shiftRows(1, 1, rowIndex - 1);
            workbook.write(output);
            return new MockMultipartFile("file", "users.xlsx", "application/octet-stream", output.toByteArray());
        }
    }

    private void actor(Set<String> permissions)
    {
        SysUser actor = new SysUser(9L);
        actor.setUserName("operator");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(9L, 103L, actor, permissions));
    }

    private static MockMultipartFile workbook(String... usernames) throws Exception
    {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream())
        {
            var sheet = workbook.createSheet("用户数据");
            String[] columns = {"部门编号", "登录名称", "用户名称", "账号状态", "用户性别"};
            var header = sheet.createRow(0);
            for (int index = 0; index < columns.length; index++) header.createCell(index).setCellValue(columns[index]);
            for (int index = 0; index < usernames.length; index++)
            {
                var row = sheet.createRow(index + 1);
                row.createCell(0).setCellValue(103);
                row.createCell(1).setCellValue(usernames[index]);
                row.createCell(2).setCellValue("Imported profile");
                row.createCell(3).setCellValue("停用");
                row.createCell(4).setCellValue("未知");
            }
            workbook.write(output);
            return new MockMultipartFile("file", "users.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output.toByteArray());
        }
    }

    @TestConfiguration
    static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
