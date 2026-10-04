package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
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
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.domain.SysPost;
import io.eforge.enterprise.system.service.ISysPostService;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Uses production method permissions and security filters, with isolated persistence. */
@WebMvcTest
@ContextConfiguration(classes = {PostController.class, PermissionService.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, PostControllerTest.Configuration.class})
class PostControllerTest
{
    private static final String PATH = "/api/v1/system/posts";
    private static final String BODY = "{\"code\":\"dev\",\"name\":\"Developer\",\"sort\":1,\"status\":\"0\"}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysPostService posts;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;

    @BeforeEach void authenticate()
    {
        SysUser user = new SysUser(); user.setUserName("admin");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(1L, 103L, user, Set.of("*:*:*")));
    }
    private static SysPost row(long id)
    {
        SysPost post = new SysPost(); post.setPostId(id); post.setPostCode("dev");
        post.setPostName("Developer"); post.setPostSort(1); post.setStatus("0"); return post;
    }

    @Test void listIsConcreteAndStablePagingIsCleared() throws Exception
    {
        when(posts.selectPostList(any())).thenReturn(List.of(row(9007199254740993L)));
        mvc.perform(get(PATH).param("page", "2").param("pageSize", "5")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("9007199254740993"))
                .andExpect(jsonPath("$.items[0].flag").doesNotExist()).andExpect(jsonPath("$.rows").doesNotExist())
                .andExpect(jsonPath("$.page").value(2)).andExpect(jsonPath("$.pageSize").value(5));
        org.junit.jupiter.api.Assertions.assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }

    @ParameterizedTest @ValueSource(strings = {"0", "-1", "1000001", "bad"})
    void invalidPageDoesNotReachPersistence(String value) throws Exception
    {
        mvc.perform(get(PATH).param("page", value)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(posts);
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "null", "{\"code\":\"x\",\"name\":\"x\",\"sort\":-1,\"status\":\"2\"}"})
    void invalidBodyDoesNotReachPersistence(String body) throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(posts);
    }

    @Test void createdPostHasLocationAndSafeFields() throws Exception
    {
        when(posts.checkPostCodeUnique(any())).thenReturn(true);
        when(posts.checkPostNameUnique(any())).thenReturn(true);
        when(posts.insertPost(any())).thenAnswer(invocation -> { ((SysPost) invocation.getArgument(0)).setPostId(5L); return 1; });
        when(posts.selectPostById(5L)).thenReturn(row(5L));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated())
                .andExpect(header().string("Location", PATH + "/5")).andExpect(jsonPath("$.id").value("5"));
        verify(posts).insertPost(argThat(post -> "admin".equals(post.getCreateBy()) && "".equals(post.getRemark())));
    }

    @Test void duplicateCodeReturnsConflictAndDoesNotWrite() throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("POST_CODE_EXISTS"));
        verify(posts, never()).insertPost(any());
    }

    @Test void concurrentPersistenceConflictDoesNotExposeDatabaseDiagnostics() throws Exception
    {
        when(posts.checkPostCodeUnique(any())).thenReturn(true);
        when(posts.checkPostNameUnique(any())).thenReturn(true);
        when(posts.insertPost(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("SQL diagnostic secret"));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("POST_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("SQL diagnostic"))));
    }

    @Test void missingAndAssignedRowsPreventWholeBatchDelete() throws Exception
    {
        when(posts.selectPostById(1L)).thenReturn(row(1));
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"2\"]}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("POST_NOT_FOUND"));
        when(posts.countUserPostById(1L)).thenReturn(1);
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("POST_IN_USE"));
        verify(posts, never()).deletePostByIds(any());
    }

    @ParameterizedTest @ValueSource(strings = {"{\"ids\":[]}", "{\"ids\":[null]}", "{\"ids\":[\"0\"]}", "{\"ids\":[\"9999999999999999999\"]}"})
    void invalidDeleteIdentifiersNeverWrite(String body) throws Exception
    {
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(posts);
    }

    @Test void deniedSessionCannotReadOrMutate() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L, 105L, new SysUser(), Set.of()));
        mvc.perform(get(PATH)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(PATH + "/export")).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/1")).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/1").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        verifyNoInteractions(posts);
    }

    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
