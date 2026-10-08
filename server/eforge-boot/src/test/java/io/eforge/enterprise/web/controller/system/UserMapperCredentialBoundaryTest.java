package io.eforge.enterprise.web.controller.system;

import java.io.InputStream;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.system.mapper.SysUserMapper;
import io.eforge.enterprise.system.service.impl.SysUserServiceImpl;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exercise the actual shared MyBatis XML, rather than a copied SQL or mocked mapper. */
class UserMapperCredentialBoundaryTest
{
    private static final String NAMESPACE = "io.eforge.enterprise.system.mapper.SysUserMapper.";
    private static Configuration configuration;

    @BeforeAll static void readActualMapper() throws Exception
    {
        configuration = new Configuration();
        configuration.getTypeAliasRegistry().registerAlias("SysUser", SysUser.class);
        configuration.getTypeAliasRegistry().registerAlias("SysDept", SysDept.class);
        configuration.getTypeAliasRegistry().registerAlias("SysRole", SysRole.class);
        String resource = "mapper/system/SysUserMapper.xml";
        try (InputStream input = UserMapperCredentialBoundaryTest.class.getClassLoader().getResourceAsStream(resource))
        {
            assertNotNull(input, "Actual system mapper must be available on the application classpath");
            new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
        }
    }

    @ParameterizedTest @NullAndEmptySource
    @ValueSource(strings = {"unexpected-plaintext", "$2a$10$precomputed-attacker-selected-hash"})
    void ordinaryUpdatesCannotAddressThePasswordColumnEvenWithAnUnsanitizedEntity(String password)
    {
        SysUser patch = new SysUser(2L); patch.setDeptId(0L); patch.setNickName("Safe profile change");
        patch.setPassword(password);
        BoundSql sql = configuration.getMappedStatement(NAMESPACE + "updateUser").getBoundSql(patch);
        assertFalse(sql.getSql().matches("(?is).*\\bpassword\\s*=.*"), sql.getSql());
        assertTrue(sql.getParameterMappings().stream().noneMatch(parameter -> parameter.getProperty().equals("password")));
        assertTrue(sql.getParameterMappings().stream().anyMatch(parameter -> parameter.getProperty().equals("nickName")));
    }

    @Test void explicitResetStillUpdatesTheCredentialAndPasswordTimestamp()
    {
        BoundSql sql = configuration.getMappedStatement(NAMESPACE + "resetUserPwd")
                .getBoundSql(Map.of("userId", 2L, "password", "a-validated-bcrypt-hash"));
        assertTrue(sql.getSql().matches("(?is).*\\bpassword\\s*=.*"), sql.getSql());
        assertTrue(sql.getSql().contains("pwd_update_date"));
        assertTrue(sql.getParameterMappings().stream().anyMatch(parameter -> parameter.getProperty().equals("password")));
    }

    @Test void accountCreationStillPersistsItsValidatedInitialPassword()
    {
        SysUser account = new SysUser(); account.setUserName("new-account"); account.setPassword("a-validated-bcrypt-hash");
        BoundSql sql = configuration.getMappedStatement(NAMESPACE + "insertUser").getBoundSql(account);
        assertTrue(sql.getParameterMappings().stream().anyMatch(parameter -> parameter.getProperty().equals("password")));
    }

    @Test void cachedProfileCannotRestoreDepartmentStatusAvatarOrCredentialsThroughTheSharedService()
    {
        SysUserMapper mapper = mock(SysUserMapper.class);
        SysUserServiceImpl service = new SysUserServiceImpl();
        ReflectionTestUtils.setField(service, "userMapper", mapper);
        when(mapper.updateUser(any())).thenReturn(1);
        SysUser cached = new SysUser(2L);
        cached.setDeptId(105L); cached.setStatus("0"); cached.setAvatar("/profile/old.png");
        cached.setPassword("old-or-injected-hash"); cached.setLoginIp("127.0.0.1");
        cached.setLoginDate(new Date()); cached.setRemark("old administrative note");
        cached.setNickName("Updated member"); cached.setEmail("updated@example.test");
        cached.setPhonenumber("13800138000"); cached.setSex("2"); cached.setUpdateBy("member");

        assertEquals(1, service.updateUserProfile(cached));

        ArgumentCaptor<SysUser> argument = ArgumentCaptor.forClass(SysUser.class);
        verify(mapper).updateUser(argument.capture());
        SysUser patch = argument.getValue();
        assertNotSame(cached, patch);
        assertEquals(0L, patch.getDeptId());
        assertNull(patch.getStatus()); assertNull(patch.getAvatar()); assertNull(patch.getPassword());
        assertEquals("Updated member", patch.getNickName());
        assertEquals("updated@example.test", patch.getEmail());
        assertEquals("13800138000", patch.getPhonenumber());
        assertEquals("2", patch.getSex()); assertEquals("member", patch.getUpdateBy());
        // Evaluate the actual dynamic SQL with the service's real patch, not a copied statement.
        BoundSql sql = configuration.getMappedStatement(NAMESPACE + "updateUser").getBoundSql(patch);
        assertEquals(List.of("nickName", "email", "phonenumber", "sex", "updateBy", "userId"),
                sql.getParameterMappings().stream().map(parameter -> parameter.getProperty()).toList());
        assertFalse(sql.getSql().matches("(?is).*\\b(dept_id|status|avatar|password|login_ip|login_date|remark)\\s*=.*"), sql.getSql());
        assertEquals(105L, cached.getDeptId(), "Sanitizing a command must not corrupt the request's session snapshot");
    }

    @Test void avatarServiceStillUsesItsDedicatedWrite()
    {
        SysUserMapper mapper = mock(SysUserMapper.class);
        SysUserServiceImpl service = new SysUserServiceImpl();
        ReflectionTestUtils.setField(service, "userMapper", mapper);
        when(mapper.updateUserAvatar(2L, "/profile/current.png")).thenReturn(1);
        assertTrue(service.updateUserAvatar(2L, "/profile/current.png"));
        verify(mapper).updateUserAvatar(2L, "/profile/current.png");
        verify(mapper, never()).updateUser(any());
        BoundSql sql = configuration.getMappedStatement(NAMESPACE + "updateUserAvatar")
                .getBoundSql(Map.of("userId", 2L, "avatar", "/profile/current.png"));
        assertEquals(List.of("avatar", "userId"),
                sql.getParameterMappings().stream().map(parameter -> parameter.getProperty()).toList());
    }
}
