package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import java.time.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
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
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.generator.mapper.GenTableMapper;
import io.eforge.enterprise.generator.mapper.GenTableColumnMapper;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.domain.GenTableColumn;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={GeneratorSynchronizationController.class,io.eforge.enterprise.generator.service.GeneratorSynchronizationService.class,io.eforge.enterprise.generator.controller.GenController.class,io.eforge.enterprise.generator.service.GenTableServiceImpl.class,GlobalExceptionHandler.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorSynchronizationControllerTest.Configuration.class})
class GeneratorSynchronizationControllerTest {
    static final String PATH="/api/v1/tool/generator/tables/";
    @Autowired MockMvc mvc;
    @MockitoBean io.eforge.enterprise.generator.service.GeneratorMetadataBoundary boundary;
    @MockitoBean io.eforge.enterprise.generator.service.IGenTableColumnService legacyColumnService;
    @MockitoBean GenTableMapper tables;
    @MockitoBean GenTableColumnMapper columns;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare(){actor(Set.of("tool:gen:edit"));}
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("editor");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void originalEditOnlyGrantAndMissingId(){var table=new GenTable();table.setTableId(9007199254740993L);table.setTableName("owned_table");table.setTplCategory("crud");var field=new GenTableColumn();field.setColumnName("name");field.setColumnType("varchar(64)");field.setIsPk("0");field.setIsIncrement("0");when(tables.selectGenTableById(9007199254740993L)).thenReturn(table);when(tables.selectGenTableAll()).thenReturn(List.of());when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(field));when(columns.selectGenTableColumnListByTableId(any())).thenReturn(List.of());when(columns.insertGenTableColumn(any())).thenReturn(1);assertDoesNotThrow(()->mvc.perform(post(PATH+"9007199254740993/synchronize")).andExpect(status().isNoContent()));assertEquals("editor",field.getCreateBy());assertDoesNotThrow(()->mvc.perform(post(PATH+"1/synchronize")).andExpect(status().isNotFound()));}
    @Test void unrelatedGrantsAndAnonymousCannotLock() throws Exception {for(var grants:List.of(Set.of("tool:gen:list","tool:gen:query","tool:gen:import","tool:gen:remove"),Set.<String>of())){actor(grants);mvc.perform(post(PATH+"1/synchronize")).andExpect(status().isForbidden());}when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(post(PATH+"1/synchronize")).andExpect(status().isUnauthorized());verifyNoInteractions(boundary,tables,columns);}
    @ParameterizedTest @ValueSource(strings={"0","-1","not-id","9223372036854775808"}) void invalidIdDoesNotLock(String id) throws Exception {mvc.perform(post(PATH+id+"/synchronize")).andExpect(status().isBadRequest());verifyNoInteractions(boundary,tables,columns);}
    @Test void sqlFailureIsSanitized() throws Exception {when(tables.selectGenTableById(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private database"));mvc.perform(post(PATH+"1/synchronize")).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));}
    @Test void originalSqlFailureKeepsCompatibilityShapeWithoutPrivateDetails() throws Exception {when(tables.selectGenTableByName("owned_table")).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private SQL connection details"));mvc.perform(get("/tool/gen/synchDb/owned_table")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.msg").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));}
    @TestConfiguration static class Configuration {@Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
