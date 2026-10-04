package io.eforge.enterprise.web.controller.api.v1.system;

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
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.domain.SysConfig;
import io.eforge.enterprise.system.service.ConfigurationValueReader;
import io.eforge.enterprise.common.core.redis.RedisCache;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={ConfigurationController.class,ConfigurationService.class,PermissionService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,ConfigurationControllerTest.Configuration.class})
class ConfigurationControllerTest
{
    static final String PATH="/api/v1/system/configurations";
    static final String BODY="{\"name\":\"参数\",\"key\":\"app.example\",\"value\":\"值\",\"builtin\":false,\"remark\":\"\"}";
    @Autowired MockMvc mvc;
    @MockitoBean SysConfigMapper configs;
    @MockitoBean ConfigurationMutationMapper writes;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean ConfigurationValueReader values;
    @MockitoBean RedisCache cache;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    SysConfig row;
    @BeforeEach void prepare()
    {
        actor(Set.of("*:*:*"));when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);
        row=new SysConfig();row.setConfigId(1L);row.setConfigName("参数");row.setConfigKey("app.example");row.setConfigValue("值");row.setConfigType("N");row.setRemark("old");
        when(configs.selectConfigById(1L)).thenReturn(row);when(configs.selectConfigList(any())).thenReturn(List.of(row));when(cache.keys(anyString())).thenReturn(List.of("sys_config:old"));
        when(writes.insert(any())).thenAnswer(call->{SysConfig created=call.getArgument(0);created.setConfigId(9007199254740993L);when(configs.selectConfigById(created.getConfigId())).thenReturn(created);return 1;});
        when(values.get("app.example")).thenReturn("值");when(values.get("missing")).thenReturn("");
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("operator");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void concreteResponseAndPagingCleanup() throws Exception
    {mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("1")).andExpect(jsonPath("$.items[0].builtin").value(false)).andExpect(jsonPath("$.items[0].configId").doesNotExist()).andExpect(jsonPath("$.items[0].params").doesNotExist());Assertions.assertNull(com.github.pagehelper.PageHelper.getLocalPage());}
    @Test void consumersRequireLoginButNoManagementGrants() throws Exception
    {actor(Set.of());mvc.perform(get(PATH+"/lookup?key=app.example")).andExpect(status().isOk()).andExpect(jsonPath("$.value").value("值"));mvc.perform(get(PATH+"/lookup?key=missing")).andExpect(jsonPath("$.value").value(""));when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(PATH+"/lookup?key=app.example")).andExpect(status().isUnauthorized());}
    @Test void allManagementPermissionsAreAuthoritative() throws Exception
    {actor(Set.of());mvc.perform(get(PATH)).andExpect(status().isForbidden());mvc.perform(get(PATH+"/1")).andExpect(status().isForbidden());mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());mvc.perform(put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}")).andExpect(status().isForbidden());mvc.perform(post(PATH+"/export")).andExpect(status().isForbidden());mvc.perform(post(PATH+"/cache/refresh")).andExpect(status().isForbidden());verifyNoInteractions(writes);}
    @Test void createsPreserveExactLargeIdsAndLocations() throws Exception
    {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated()).andExpect(header().string("Location",PATH+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993"));verify(cache).deleteObject(anyCollection());verify(cache).setCacheObject("sys_config:app.example","值");}
    @Test void updatePreservesBuiltinEditabilityAndClearsRemarks() throws Exception
    {row.setConfigType("Y");mvc.perform(put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isNoContent());verify(configs).updateConfig(argThat(updated->updated.getConfigType().equals("N") && updated.getRemark().equals("") && updated.getConfigValue().equals("值")));}
    @Test void builtinOrMissingBatchMemberPreventsEveryDeletion() throws Exception
    {var builtin=new SysConfig();builtin.setConfigId(2L);builtin.setConfigType("Y");when(configs.selectConfigById(2L)).thenReturn(builtin);mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"2\"]}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFIGURATION_BUILTIN"));mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"999\"]}")).andExpect(status().isNotFound());verify(configs,never()).deleteConfigById(any());}
    @Test void duplicatesAndDatabaseUniqueRacesAreConflicts() throws Exception
    {when(configs.checkConfigKeyUnique(anyString())).thenReturn(row);mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict());verifyNoInteractions(writes);when(configs.checkConfigKeyUnique(anyString())).thenReturn(null);doThrow(new org.springframework.dao.DuplicateKeyException("race")).when(writes).insert(any());mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFIGURATION_KEY_EXISTS"));}
    @Test void cacheFailureRollsBackWrites() throws Exception
    {doThrow(new IllegalStateException("Redis unavailable")).when(cache).deleteObject(anyCollection());mvc.perform(put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("CONFIGURATION_CACHE_UNAVAILABLE"));verify(transactions).rollback(any());verify(transactions,never()).commit(any());}
    @Test void refreshClearsAliasKeysAndReloadsAllValues() throws Exception
    {mvc.perform(post(PATH+"/cache/refresh")).andExpect(status().isNoContent());var order=inOrder(mutex,cache,configs);order.verify(mutex).lockRoot();order.verify(cache).keys("sys_config:*");order.verify(cache).deleteObject(anyCollection());order.verify(configs).selectConfigList(any());order.verify(cache).setCacheObject("sys_config:app.example","值");}
    @Test void filteredExportRemainsBinaryAndDateRangeIsValidated() throws Exception
    {mvc.perform(post(PATH+"/export?builtin=true&from=2026-10-04&to=2026-10-05")).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));verify(configs).selectConfigList(argThat(filter->"Y".equals(filter.getConfigType()) && "2026-10-04".equals(filter.getParams().get("beginTime"))));mvc.perform(get(PATH+"?from=2026-10-05&to=2026-10-04")).andExpect(status().isBadRequest());}
    @ParameterizedTest @ValueSource(strings={"?page=0","?pageSize=101","?builtin=invalid","/0","/9223372036854775808","/lookup?key=","?from=bad"})
    void invalidQueriesUseProblemDetails(String query) throws Exception {mvc.perform(get(PATH+query)).andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"));}
    @Test void invalidWritesDoNotReachMappers() throws Exception
    {mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"值\"","\" \""))).andExpect(status().isBadRequest());mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("false","null"))).andExpect(status().isBadRequest());verifyNoInteractions(writes);}
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
