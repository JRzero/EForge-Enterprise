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
@ContextConfiguration(classes={GeneratorConfigurationController.class,GeneratorConfigurationService.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorConfigurationControllerTest.Configuration.class})
class GeneratorConfigurationControllerTest {
    static final long ID=9007199254740993L;
    static final String PATH="/api/v1/tool/generator/tables/"+ID;
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @MockitoBean GenTableMapper tables;
    @MockitoBean GenTableColumnMapper columns;
    @MockitoBean io.eforge.enterprise.system.mapper.SysMenuMapper menus;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare() {
        actor(Set.of("tool:gen:edit"));
        var table=new GenTable();table.setTableId(ID);table.setTableName("owned_table");table.setTplWebType("element-ui");
        var field=new GenTableColumn();field.setColumnId(ID+1);field.setTableId(ID);field.setColumnName("entry_id");field.setColumnType("bigint");field.setIsPk("1");field.setIsIncrement("1");
        when(jdbc.queryForList("SELECT table_id FROM gen_table WHERE table_id=? FOR UPDATE",Long.class,ID)).thenReturn(List.of(ID));
        when(tables.selectGenTableById(ID)).thenReturn(table);when(columns.selectGenTableColumnListByTableId(ID)).thenReturn(List.of(field));
        when(tables.updateGenTable(any())).thenReturn(1);when(columns.updateGenTableColumn(any())).thenReturn(1);
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("editor");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    com.fasterxml.jackson.databind.node.ObjectNode input() throws Exception{return (com.fasterxml.jackson.databind.node.ObjectNode)json.readTree("""
        {"name":"owned_table","comment":"中文表","className":"OwnedTable","category":"crud","packageName":"io.eforge.enterprise.owned","moduleName":"owned","businessName":"entry","functionName":"条目","author":"作者","formColumns":3,"outputType":"1","outputPath":"D:/生成输出","remark":"","options":{"parentMenuId":"0","generateDetail":true},"columns":[{"id":"9007199254740994","comment":"","javaType":"Boolean","javaField":"entryId","required":true,"insertable":true,"editable":false,"listed":true,"queryable":true,"queryType":"GTE","controlType":"imageUpload","dictionaryType":"","order":0}]}
        """);}
    org.springframework.test.web.servlet.ResultActions request(com.fasterxml.jackson.databind.JsonNode body) throws Exception{return mvc.perform(put(PATH).contentType("application/json").content(json.writeValueAsString(body)));}
    @Test void originalEditGrantPreservesControlsClearingAndServerPhysicalIdentity() throws Exception {
        request(input()).andExpect(status().isNoContent());
        verify(tables).updateGenTable(argThat(row->"eforge-react".equals(row.getTplWebType())&&"editor".equals(row.getUpdateBy())&&row.getFormColNum()==3&&"D:/生成输出".equals(row.getGenPath())&&"".equals(row.getRemark())&&row.getOptions().contains("\"genView\":true")));
        verify(columns).updateGenTableColumn(argThat(row->row.getColumnId()==ID+1&&row.getTableId()==ID&&"bigint".equals(row.getColumnType())&&"entry_id".equals(row.getColumnName())&&row.isPk()&&row.isIncrement()&&"Boolean".equals(row.getJavaType())&&"GTE".equals(row.getQueryType())&&"imageUpload".equals(row.getHtmlType())&&"".equals(row.getColumnComment())));
    }
    @Test void moduleAndBusinessSegmentsDoNotRequireJavaIdentifiers() throws Exception {
        var body=input();body.put("moduleName","sales-api");body.put("businessName","order-line");request(body).andExpect(status().isNoContent());
        verify(tables).updateGenTable(argThat(row->"sales-api".equals(row.getModuleName())&&"order-line".equals(row.getBusinessName())));
    }
    @Test void listQueryAndNoRoleCannotEdit() throws Exception {
        for(var grants:List.of(Set.of("tool:gen:list","tool:gen:query"),Set.<String>of())){actor(grants);request(input()).andExpect(status().isForbidden());}
        when(tokens.getLoginUser(any())).thenReturn(null);request(input()).andExpect(status().isUnauthorized());verifyNoInteractions(tables,columns,jdbc,menus);
    }
    @Test void foreignDuplicateAndMissingFieldsNeverWrite() throws Exception {
        var body=input();((com.fasterxml.jackson.databind.node.ObjectNode)body.path("columns").get(0)).put("id","1");request(body).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GENERATOR_COLUMN_MISMATCH"));
        body=input();((com.fasterxml.jackson.databind.node.ArrayNode)body.path("columns")).add(body.path("columns").get(0).deepCopy());request(body).andExpect(status().isConflict());
        var extra=new GenTableColumn();extra.setColumnId(ID+2);extra.setColumnName("extra");when(columns.selectGenTableColumnListByTableId(ID)).thenReturn(List.of(extra));request(input()).andExpect(status().isConflict());verify(tables,never()).updateGenTable(any());verify(columns,never()).updateGenTableColumn(any());
    }
    @ParameterizedTest @ValueSource(strings={"javaField","javaType","controlType","required","queryType","order"})
    void omittedFieldPropertiesAreRejectedBeforeSql(String property) throws Exception {
        var body=input();((com.fasterxml.jackson.databind.node.ObjectNode)body.path("columns").get(0)).remove(property);request(body).andExpect(status().isBadRequest());verifyNoInteractions(tables,columns,jdbc);
    }
    @Test void malformedIdentifiersAndCodeNamesDoNotWrite() throws Exception {
        var body=input();body.put("className","Bad;class");request(body).andExpect(status().isBadRequest());verifyNoInteractions(tables,columns,jdbc);
        body=input();((com.fasterxml.jackson.databind.node.ObjectNode)body.path("columns").get(0)).put("id","9223372036854775808");request(body).andExpect(status().isBadRequest());verify(tables,never()).updateGenTable(any());
    }
    @Test void invalidTreeAndSubTableAreRejected() throws Exception {
        var body=input();body.put("category","tree");request(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GENERATOR_TREE_FIELDS_INVALID"));
        body=input();body.put("category","sub");body.put("subTableName","missing");request(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GENERATOR_SUBTABLE_INVALID"));verify(tables,never()).updateGenTable(any());
    }
    @Test void missingAndFaultHaveSanitizedErrors() throws Exception {
        when(jdbc.queryForList("SELECT table_id FROM gen_table WHERE table_id=? FOR UPDATE",Long.class,ID)).thenReturn(List.of());request(input()).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GENERATOR_TABLE_NOT_FOUND"));
        when(jdbc.queryForList("SELECT table_id FROM gen_table WHERE table_id=? FOR UPDATE",Long.class,ID)).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private SQL"));request(input()).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));
    }
    @Test void failedFieldWriteNeverReturnsSuccess() throws Exception {
        when(columns.updateGenTableColumn(any())).thenReturn(0);request(input()).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("GENERATOR_CONFIGURATION_SAVE_FAILED"));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
