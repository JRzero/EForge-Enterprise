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
@ContextConfiguration(classes={GeneratorImportController.class,GeneratorImportService.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorImportControllerTest.Configuration.class})
class GeneratorImportControllerTest {
    static final String PATH="/api/v1/tool/generator/imports";
    @Autowired MockMvc mvc;
    @MockitoBean io.eforge.enterprise.generator.service.GeneratorMetadataBoundary boundary;
    @MockitoBean GenTableMapper tables;
    @MockitoBean GenTableColumnMapper columns;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare() {
        actor(Set.of("tool:gen:import"));
        io.eforge.enterprise.generator.config.GenConfig.packageName="io.eforge.enterprise.owned";
        io.eforge.enterprise.generator.config.GenConfig.author="作者";
        var table=new GenTable();table.setTableName("owned_table");table.setTableComment("中文表");
        var field=new GenTableColumn();field.setColumnName("entry_id");field.setColumnType("bigint");field.setIsPk("1");field.setSort(1);
        when(tables.selectDbTableListByNames(any())).thenReturn(List.of(table));
        when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(field));
        when(tables.insertGenTable(any())).thenAnswer(invocation->{var row=(GenTable)invocation.getArgument(0);row.setTableId(9007199254740993L);return 1;});
        when(columns.insertGenTableColumn(any())).thenReturn(1);
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("importer");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    org.springframework.test.web.servlet.ResultActions request(String body) throws Exception{return mvc.perform(post(PATH).contentType("application/json").content(body));}
    @Test void originalImportGrantReturnsCreatedExactIdAndInitializesFields() throws Exception {
        request("{\"names\":[\"owned_table\"]}").andExpect(status().isCreated()).andExpect(jsonPath("$.tables[0].id").value("9007199254740993")).andExpect(jsonPath("$.tables[0].columnCount").value(1)).andExpect(jsonPath("$.rows").doesNotExist());
        verify(tables).insertGenTable(argThat(row->"importer".equals(row.getCreateBy())&&"eforge-react".equals(row.getTplWebType())));
        verify(columns).insertGenTableColumn(argThat(row->row.getTableId()==9007199254740993L&&"entryId".equals(row.getJavaField())&&"Long".equals(row.getJavaType())));
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"names\":[]}","{\"names\":[null]}","{\"names\":[\"\"]}","{\"names\":[\"owned_table\",\"OWNED_TABLE\"]}"})
    void malformedSelectionNeverReachesSql(String body) throws Exception{request(body).andExpect(status().isBadRequest());verifyNoInteractions(tables,columns);}
    @Test void missingSelectedTableRejectsWholeBatchBeforeWrites() throws Exception {
        request("{\"names\":[\"owned_table\",\"missing\"]}").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GENERATOR_DATABASE_TABLE_NOT_FOUND"));verify(tables,never()).insertGenTable(any());verify(columns,never()).insertGenTableColumn(any());
    }
    @Test void originalSplitGrantAndAnonymousAreAuthoritative() throws Exception {
        actor(Set.of("tool:gen:list","tool:gen:query"));request("{\"names\":[\"owned_table\"]}").andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);request("{\"names\":[\"owned_table\"]}").andExpect(status().isUnauthorized());verifyNoInteractions(tables,columns);
    }
    @Test void existingImportAndRaceHaveSanitizedConflict() throws Exception {
        when(tables.selectGenTableByName(any())).thenReturn(new GenTable());request("{\"names\":[\"owned_table\"]}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GENERATOR_TABLE_ALREADY_IMPORTED"));
        when(tables.selectGenTableByName(any())).thenReturn(null);doThrow(new org.springframework.dao.DuplicateKeyException("private SQL")).when(tables).insertGenTable(any());request("{\"names\":[\"owned_table\"]}").andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));verify(columns,never()).insertGenTableColumn(any());
    }
    @Test void vanishedSchemaAndZeroWritesNeverSucceed() throws Exception {
        when(columns.selectDbTableColumnsByName(any())).thenReturn(List.of());request("{\"names\":[\"owned_table\"]}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GENERATOR_SCHEMA_CHANGED"));verify(tables,never()).insertGenTable(any());
    }
    @Test void failedColumnInsertReturnsTypedFailure() throws Exception {
        when(columns.insertGenTableColumn(any())).thenReturn(0);request("{\"names\":[\"owned_table\"]}").andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("GENERATOR_IMPORT_FAILED"));
    }
    @Test void sqlFailureDoesNotPublishSql() throws Exception {
        when(tables.selectDbTableListByNames(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private database"));request("{\"names\":[\"owned_table\"]}").andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));verify(tables,never()).insertGenTable(any());
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
