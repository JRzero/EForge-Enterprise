package io.eforge.enterprise.web.controller.api.v1.auth;
import java.util.Set;
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
import org.springframework.dao.DataAccessResourceFailureException;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.security.handle.AuthenticationEntryPointImpl;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.ApiRoutingExceptionResolver;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest
@ContextConfiguration(classes={UnlockScreenController.class,UnlockScreenService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,UnlockScreenControllerTest.Configuration.class})
class UnlockScreenControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ISysUserService users;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    SysUser user;
    static final String PATH="/api/v1/auth/unlock-screen";
    @BeforeEach void authenticate(){
        user=new SysUser(9007199254740993L);user.setUserName("ordinary");user.setStatus("0");user.setDelFlag("0");user.setPassword(SecurityUtils.encryptPassword("Current123"));
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(user.getUserId(),null,user,Set.of()));when(users.selectUserById(user.getUserId())).thenReturn(user);
    }
    @Test void actualNoRolePrincipalVerifiesOnlyItsCurrentSqlPasswordWithoutSessionWrite() throws Exception {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\",\"userId\":1,\"username\":\"admin\"}"))
            .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().doesNotExist("Set-Cookie")).andExpect(content().string(""));
        verify(users).selectUserById(9007199254740993L);verifyNoMoreInteractions(users);verify(tokens,never()).setLoginUser(any());
    }
    @Test void wrongPasswordDoesNotBecomeAnAuthenticationExpiryOrExposeHash() throws Exception {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Wrong123\"}"))
            .andExpect(status().isForbidden()).andExpect(content().contentTypeCompatibleWith("application/problem+json")).andExpect(jsonPath("$.code").value("SCREEN_UNLOCK_PASSWORD_MISMATCH"));
        verify(tokens,never()).delLoginUser(any());
    }
    @Test void authoritativePasswordChangeRejectsTheOldCachedPrincipalHash() throws Exception {
        var fresh=new SysUser(user.getUserId());fresh.setStatus("0");fresh.setDelFlag("0");fresh.setPassword(SecurityUtils.encryptPassword("Changed123"));when(users.selectUserById(user.getUserId())).thenReturn(fresh);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Changed123\"}")).andExpect(status().isNoContent());
    }
    @Test void anonymousCannotValidateAnyPasswordOrCauseSql() throws Exception {when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isUnauthorized());verifyNoInteractions(users);}
    @ParameterizedTest @ValueSource(strings={"{}","{\"password\":null}","{\"password\":\"\"}","{\"password\":\"                     \"}","{\"password\":\"123456789012345678901\"}"}) void invalidBodyStopsBeforeSql(String body) throws Exception {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verifyNoInteractions(users);}
    @Test void disabledAndDeletedCurrentAccountsCannotResume() throws Exception {user.setStatus("1");mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isUnauthorized());user.setStatus("0");user.setDelFlag("2");mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isUnauthorized());}
    @Test void missingAccountCannotResume() throws Exception {when(users.selectUserById(user.getUserId())).thenReturn(null);mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isUnauthorized());}
    @Test void sqlFaultUsesFixedSafeProblemAndRecoveryKeepsTheSameActor() throws Exception {when(users.selectUserById(user.getUserId())).thenThrow(new DataAccessResourceFailureException("jdbc-secret Current123 SELECT private SQL"));mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.detail").value("Screen unlock is temporarily unavailable."));doReturn(user).when(users).selectUserById(user.getUserId());mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isNoContent());}
    @Test void invalidStoredHashHasNoDriverOrHashInProblem() throws Exception {user.setPassword("invalid-private-hash");mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Current123\"}")).andExpect(status().isForbidden());}
    @Test void requestDiagnosticsAndJsonNeverExposePassword() throws Exception {var request=new UnlockScreenRequest("Diagnostic123");org.junit.jupiter.api.Assertions.assertEquals("UnlockScreenRequest[credentials redacted]",request.toString());org.junit.jupiter.api.Assertions.assertEquals("{}",new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request));}
    @TestConfiguration static class Configuration {@Bean PermitAllUrlProperties permits(){return new PermitAllUrlProperties();}@Bean CorsFilter cors(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
