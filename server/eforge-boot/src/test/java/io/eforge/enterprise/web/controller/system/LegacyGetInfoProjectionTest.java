package io.eforge.enterprise.web.controller.system;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.SysLoginService;
import io.eforge.enterprise.system.service.ISysConfigService;
import io.eforge.enterprise.system.service.ISysMenuService;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Legacy projection consumes the JWT-verified active-role snapshot without querying authority again. */
class LegacyGetInfoProjectionTest
{
    private final ISysConfigService configuration = mock(ISysConfigService.class);
    private final ISysMenuService menus = mock(ISysMenuService.class);
    private final SysLoginService login = mock(SysLoginService.class);
    private MockMvc mvc;
    private LoginUser principal;

    @BeforeEach void setup()
    {
        var controller = new SysLoginController();
        ReflectionTestUtils.setField(controller, "configService", configuration);
        ReflectionTestUtils.setField(controller, "menuService", menus);
        ReflectionTestUtils.setField(controller, "loginService", login);
        when(configuration.selectConfigByKey(anyString())).thenReturn("0");
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
        SysUser user = new SysUser(7L); user.setUserName("reader"); user.setDeptId(105L);
        user.setRoles(List.of()); user.setStatus("0"); user.setDelFlag("0");
        principal = new LoginUser(7L, 105L, user, Set.of("system:post:list"));
        principal.setToken("unchanged-session"); principal.setExpireTime(123456L);
        principal.rememberCacheSnapshot(new byte[] {1, 2, 3});
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    static Stream<Arguments> legacyKeys()
    {
        return Stream.of(
                Arguments.of(" sales ", List.of("sales")),
                Arguments.of("sales,finance", List.of("sales", "finance")),
                Arguments.of(" sales,finance ", List.of("sales", "finance")),
                Arguments.of("sales, finance", List.of("sales", " finance")),
                Arguments.of("sales,,finance", List.of("sales", "", "finance")),
                Arguments.of("sales,finance,", List.of("sales", "finance")));
    }

    @ParameterizedTest @MethodSource("legacyKeys")
    void roleKeysKeepOriginalWholeValueTrimAndCommaSplitting(String key, List<String> expected) throws Exception
    {
        principal.getUser().setRoles(List.of(role(3L, key)));
        expectSnapshot(expected);
        assertEquals(key, principal.getUser().getRoles().get(0).getRoleKey(), "Projection must not rewrite the verified role");
    }

    @Test void duplicateKeysCollapseAndNullKeyIsIgnoredWithoutReintroducingUnassignedRoles() throws Exception
    {
        principal.getUser().setRoles(Arrays.asList(role(3L, "sales,finance"), role(4L, "finance"), role(5L, null)));
        expectSnapshot(List.of("sales", "finance"));
        assertEquals(3, principal.getUser().getRoles().size());
    }

    @Test void emptyActiveRolesStayEmptyWithoutTheLegacyDatabaseFallback() throws Exception
    {
        principal.setPermissions(Set.of());
        expectSnapshot(List.of());
    }

    @Test void administratorKeepsTheSingleAdminProjection() throws Exception
    {
        principal.setUserId(1L); principal.getUser().setUserId(1L);
        principal.setPermissions(Set.of("*:*:*"));
        principal.getUser().setRoles(List.of(role(3L, "other,ignored")));
        expectSnapshot(List.of("admin"));
    }

    private void expectSnapshot(List<String> expectedRoles) throws Exception
    {
        var current = principal.getUser(); var permissions = principal.getPermissions();
        mvc.perform(get("/getInfo")).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.roles", containsInAnyOrder(expectedRoles.toArray(String[]::new))))
                .andExpect(jsonPath("$.permissions", containsInAnyOrder(permissions.toArray(String[]::new))))
                .andExpect(jsonPath("$.user.userName").value("reader"))
                .andExpect(jsonPath("$.user.deptId").value(105));
        assertSame(current, principal.getUser()); assertSame(permissions, principal.getPermissions());
        assertEquals("unchanged-session", principal.getToken()); assertEquals(123456L, principal.getExpireTime());
        assertArrayEquals(new byte[] {1, 2, 3}, principal.cacheSnapshot());
        verifyNoInteractions(menus, login);
        verify(configuration).selectConfigByKey("sys.account.chrtype");
        verify(configuration).selectConfigByKey("sys.account.initPasswordModify");
        verify(configuration).selectConfigByKey("sys.account.passwordValidateDays");
        verifyNoMoreInteractions(configuration);
    }

    private static SysRole role(long id, String key)
    {
        SysRole role = new SysRole(id); role.setRoleKey(key); role.setStatus("0"); role.setDelFlag("0");
        return role;
    }
}
