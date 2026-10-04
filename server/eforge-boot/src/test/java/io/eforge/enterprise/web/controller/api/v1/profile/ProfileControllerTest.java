package io.eforge.enterprise.web.controller.api.v1.profile;

import java.util.*;
import org.junit.jupiter.api.*;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes = {ProfileController.class, ProfileService.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, ProfileControllerTest.Configuration.class})
class ProfileControllerTest
{
    private static final String PATH = "/api/v1/me";
    private static final String BODY = "{\"displayName\":\"My name\",\"email\":\"me@example.com\",\"phone\":\"13800138000\",\"sex\":\"1\"}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysUserService users;
    @MockitoBean TokenService tokens;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean AvatarStore avatars;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    SysUser user; LoginUser session;
    @BeforeEach void authenticate()
    {
        user = new SysUser(9007199254740993L); user.setUserName("ordinary"); user.setNickName("Current name");
        user.setDeptId(105L); user.setStatus("0"); user.setDelFlag("0"); user.setPassword(SecurityUtils.encryptPassword("Old12345"));
        session = new LoginUser(user.getUserId(), 105L, user, Set.of()); session.setToken("owned-session");
        when(tokens.getLoginUser(any())).thenReturn(session);
        when(users.selectUserById(user.getUserId())).thenReturn(user);
        when(users.selectUserRoleGroup(any())).thenReturn("Ordinary role"); when(users.selectUserPostGroup(any())).thenReturn("Engineer");
        when(users.checkPhoneUnique(any())).thenReturn(true); when(users.checkEmailUnique(any())).thenReturn(true);
        when(users.updateUserProfile(any())).thenReturn(1); when(users.resetUserPwd(anyLong(), anyString())).thenAnswer(call -> { user.setPassword(call.getArgument(1)); return 1; });
        when(transactions.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
    }
    @Test void authenticatedNoPermissionUserReadsFreshSafeProfile() throws Exception
    {
        user.setAvatar("https://untrusted.invalid/avatar.png");
        mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.id").value("9007199254740993"))
                .andExpect(jsonPath("$.roleNames").value("Ordinary role")).andExpect(jsonPath("$.postNames").value("Engineer"))
                .andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.params").doesNotExist()).andExpect(jsonPath("$.avatarUrl").isEmpty());
    }
    @Test void profileMutationCannotMassAssignAnotherAccountOrGrants() throws Exception
    {
        String forged = BODY.substring(0, BODY.length()-1) + ",\"id\":\"1\",\"departmentId\":\"103\",\"password\":\"forged\",\"roleIds\":[\"1\"],\"status\":\"1\"}";
        mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(forged)).andExpect(status().isNoContent());
        verify(users).updateUserProfile(argThat(patch -> patch.getUserId().equals(user.getUserId()) && patch.getDeptId().equals(0L)
                && patch.getPassword() == null && patch.getRoleIds() == null && patch.getStatus() == null && "My name".equals(patch.getNickName())));
        var order = inOrder(mutations, users, transactions, tokens);
        order.verify(mutations).lockRoot(); order.verify(users).selectUserById(user.getUserId());
        order.verify(users).checkPhoneUnique(any()); order.verify(users).checkEmailUnique(any()); order.verify(users).updateUserProfile(any());
        order.verify(transactions).commit(any()); order.verify(tokens).setLoginUser(session);
        Assertions.assertEquals(105L, session.getUser().getDeptId()); Assertions.assertEquals("My name", session.getUser().getNickName());
    }
    @ParameterizedTest @ValueSource(strings = {"{}", "null", "{\"displayName\":\"<script>x</script>\",\"email\":\"me@example.com\",\"phone\":\"13800138000\",\"sex\":\"1\"}",
            "{\"displayName\":\"Name\",\"email\":\"\",\"phone\":\"13800138000\",\"sex\":\"1\"}", "{\"displayName\":\"Name\",\"email\":\"me@example.com\",\"phone\":\"bad\",\"sex\":\"1\"}"})
    void invalidProfileDoesNotWrite(String body) throws Exception
    { mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest()); verify(users, never()).updateUserProfile(any()); }
    @Test void conflictsRollbackAndDoNotRefreshOrChangeCachedFields() throws Exception
    {
        when(users.checkPhoneUnique(any())).thenReturn(false);
        mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_PHONE_EXISTS"));
        Assertions.assertEquals("Current name", session.getUser().getNickName()); verify(tokens, never()).setLoginUser(any()); verify(transactions).rollback(any());
        when(users.checkPhoneUnique(any())).thenReturn(true); when(users.updateUserProfile(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("private sql"));
        mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private sql"))));
    }
    @Test void passwordUsesDatabaseHashRejectsWrongOrUnchangedAndHashesSuccess() throws Exception
    {
        mvc.perform(put(PATH + "/password").contentType(MediaType.APPLICATION_JSON).content("{\"oldPassword\":\"wrong\",\"newPassword\":\"New12345\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OLD_PASSWORD_INVALID"));
        mvc.perform(put(PATH + "/password").contentType(MediaType.APPLICATION_JSON).content("{\"oldPassword\":\"Old12345\",\"newPassword\":\"Old12345\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PASSWORD_UNCHANGED"));
        verify(users, never()).resetUserPwd(anyLong(), anyString());
        mvc.perform(put(PATH + "/password").contentType(MediaType.APPLICATION_JSON).content("{\"oldPassword\":\"Old12345\",\"newPassword\":\"New12345\"}"))
                .andExpect(status().isNoContent());
        verify(users).resetUserPwd(eq(user.getUserId()), argThat(hash -> !"New12345".equals(hash) && SecurityUtils.matchesPassword("New12345", hash)));
        verify(tokens).setLoginUser(session);
    }
    @ParameterizedTest @ValueSource(strings = {"{\"oldPassword\":\"Old12345\",\"newPassword\":\"short\"}", "{\"oldPassword\":\"Old12345\",\"newPassword\":\"bad<123\"}", "{}"})
    void invalidPasswordFormatNeverWritesOrLeaksValues(String body) throws Exception
    { mvc.perform(put(PATH + "/password").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest()); verify(users, never()).resetUserPwd(anyLong(), anyString()); }
    @ParameterizedTest @ValueSource(strings = {"disabled", "deleted", "missing"})
    void inactiveDatabaseAccountCannotUseSelfService(String state) throws Exception
    {
        if (state.equals("disabled")) user.setStatus("1"); else if (state.equals("deleted")) user.setDelFlag("2"); else when(users.selectUserById(user.getUserId())).thenReturn(null);
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        verify(users, never()).updateUserProfile(any()); verify(tokens, atLeastOnce()).delLoginUser("owned-session");
    }
    @Test void avatarRollsBackAndRemovesOnlyNewFileOnDatabaseFailure() throws Exception
    {
        var image = new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);
        when(avatars.decode(any())).thenReturn(image); when(avatars.save(image)).thenReturn("new-owned-avatar");
        user.setAvatar("old-avatar"); when(users.updateUserAvatar(anyLong(), anyString())).thenReturn(false);
        mvc.perform(multipart(PATH + "/avatar").file("file", new byte[]{1})).andExpect(status().isConflict());
        verify(avatars).delete("new-owned-avatar"); verify(avatars, never()).delete("old-avatar"); verify(tokens, never()).setLoginUser(any());
    }
    @Test void avatarCommitsBeforeOldFileCleanupAndSessionRefresh() throws Exception
    {
        var image = new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);
        when(avatars.decode(any())).thenReturn(image); when(avatars.save(image)).thenReturn("/profile/avatar/canonical/new.png");
        user.setAvatar("old-avatar"); when(users.updateUserAvatar(anyLong(), anyString())).thenReturn(true);
        mvc.perform(multipart(PATH + "/avatar").file("file", new byte[]{1})).andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value("/profile/avatar/canonical/new.png"));
        var order = inOrder(transactions, avatars, tokens); order.verify(transactions).commit(any()); order.verify(avatars).delete("old-avatar"); order.verify(tokens).setLoginUser(session);
    }
    @Test void allOperationsRequireAuthentication() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized()); mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH + "/password").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(multipart(PATH + "/avatar").file("file",new byte[]{1})).andExpect(status().isUnauthorized());
    }
    @Test void missingOwnedAvatarReturnsHttp404InsteadOfLegacySuccessEnvelope() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(get("/profile/avatar/canonical/00000000-0000-0000-0000-000000000000.png"))
                .andExpect(status().isNotFound()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("HTTP_404"));
    }
    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
