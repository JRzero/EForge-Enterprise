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
@ContextConfiguration(classes={GeneratorReadController.class,GeneratorReadService.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorReadControllerTest.Configuration.class})
class GeneratorReadControllerTest {
    static final String PATH="/api/v1/tool/generator";
    static final long ID=9007199254740993L;
    @Autowired MockMvc mvc;
    @MockitoBean GenTableMapper tables;
    @MockitoBean GenTableColumnMapper columns;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    GenTable table;
    @BeforeEach void prepare() {
        actor(Set.of("*:*:*"));table=new GenTable();table.setTableId(ID);table.setTableName("owned_table");table.setTableComment("中文表");table.setClassName("OwnedTable");table.setTplCategory("sub");table.setTplWebType("element-plus");
        table.setPackageName("io.eforge.enterprise.owned");table.setModuleName("owned");table.setBusinessName("entry");table.setFunctionName("条目");table.setFunctionAuthor("作者");table.setFormColNum(3);table.setGenType("1");table.setGenPath("output");table.setSubTableName("child");table.setSubTableFkName("parent_id");table.setRemark("<script>inert</script>");table.setCreateBy("private actor");
        table.setOptions("{\"treeCode\":\"id\",\"treeParentCode\":\"parent_id\",\"treeName\":\"name\",\"parentMenuId\":9007199254740993,\"parentMenuName\":\"目录\",\"genView\":true,\"private\":\"secret\"}");
        table.setCreateTime(Date.from(Instant.parse("2026-10-05T00:00:00Z")));
        var column=new GenTableColumn();column.setColumnId(ID+1);column.setColumnName("entry_id");column.setColumnType("bigint");column.setJavaType("Long");column.setJavaField("entryId");column.setIsPk("1");column.setIsIncrement("1");column.setIsRequired("1");column.setIsInsert("1");column.setIsEdit("0");column.setIsList("1");column.setIsQuery("1");column.setQueryType("BETWEEN");column.setHtmlType("input");column.setDictType("sys_common_status");column.setSort(2);table.setColumns(List.of(column));
        when(tables.selectGenTableList(any())).thenReturn(List.of(table));when(tables.selectDbTableList(any())).thenReturn(List.of(table));when(tables.selectGenTableById(ID)).thenReturn(table);when(tables.selectGenTableAll()).thenReturn(List.of(table));when(columns.selectGenTableColumnListByTableId(ID)).thenReturn(List.of(column));
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void typedListsRetainStringIdsDatesWithoutLegacyFields() throws Exception {
        actor(Set.of("tool:gen:list"));mvc.perform(get(PATH+"/tables")).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(Long.toString(ID))).andExpect(jsonPath("$.items[0].createdAt").value("2026-10-05T00:00:00Z")).andExpect(jsonPath("$.items[0].createBy").doesNotExist()).andExpect(jsonPath("$.items[0].options").doesNotExist()).andExpect(jsonPath("$.rows").doesNotExist()).andExpect(jsonPath("$.pageSize").value(10));
        mvc.perform(get(PATH+"/database-tables")).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].name").value("owned_table")).andExpect(jsonPath("$.items[0].id").doesNotExist());
        mvc.perform(get(PATH+"/tables/"+ID)).andExpect(status().isForbidden());
        mvc.perform(get(PATH+"/tables/"+ID+"/columns")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(Long.toString(ID+1))).andExpect(jsonPath("$[0].tableId").value(Long.toString(ID))).andExpect(jsonPath("$[0].primaryKey").value(true)).andExpect(jsonPath("$[0].editable").value(false)).andExpect(jsonPath("$[0].queryType").value("BETWEEN"));
    }
    @Test void queryGrantRetainsFullConfigurationColumnsAndChoicesWithoutRawOptions() throws Exception {
        actor(Set.of("tool:gen:query"));mvc.perform(get(PATH+"/tables/"+ID)).andExpect(status().isOk()).andExpect(jsonPath("$.configuration.formColumns").value(3)).andExpect(jsonPath("$.configuration.subTableForeignKey").value("parent_id")).andExpect(jsonPath("$.configuration.outputPath").value("output")).andExpect(jsonPath("$.configuration.remark").value("<script>inert</script>"))
            .andExpect(jsonPath("$.configuration.options.parentMenuId").value(Long.toString(ID))).andExpect(jsonPath("$.configuration.options.generateDetail").value(true)).andExpect(jsonPath("$.configuration.options.private").doesNotExist()).andExpect(jsonPath("$.columns[0].autoIncrement").value(true)).andExpect(jsonPath("$.tables[0].columns[0].tableId").value(Long.toString(ID))).andExpect(jsonPath("$.table.params").doesNotExist());
        mvc.perform(get(PATH+"/tables")).andExpect(status().isForbidden());mvc.perform(get(PATH+"/tables/"+ID+"/columns")).andExpect(status().isForbidden());
    }
    @ParameterizedTest @ValueSource(strings={"page=0","pageSize=101","sort=drop","direction=drop","from=2026-02-30","from=2026-10-06&to=2026-10-05","from=0999-01-01","to=10000-01-01"})
    void malformedQueriesNeverReachSql(String query) throws Exception {for(String path:List.of("/tables","/database-tables"))mvc.perform(get(PATH+path+"?"+query)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));verifyNoInteractions(tables,columns);}
    @ParameterizedTest @ValueSource(strings={"0","-1","bad","9223372036854775808"})
    void malformedIdsNeverReachSql(String id) throws Exception {for(String suffix:List.of("","/columns"))mvc.perform(get(PATH+"/tables/"+id+suffix)).andExpect(status().isBadRequest());verifyNoInteractions(tables,columns);}
    @Test void anonymousAndNoGrantCannotReadAnyGeneratorResource() throws Exception {
        for(boolean anonymous:List.of(false,true)){if(anonymous)when(tokens.getLoginUser(any())).thenReturn(null);else actor(Set.of());for(String path:List.of("/tables","/database-tables","/tables/1","/tables/1/columns"))mvc.perform(get(PATH+path)).andExpect(status().is(anonymous?401:403));}verifyNoInteractions(tables,columns);
    }
    @Test void fixedSortingAndBoundParametersClearPagingAfterSuccessAndSqlFault() throws Exception {
        when(tables.selectGenTableList(any())).thenAnswer(invocation->{assertEquals("table_name asc, table_id asc",com.github.pagehelper.PageHelper.getLocalPage().getOrderBy());var filter=(GenTable)invocation.getArgument(0);assertEquals("x%' OR 1=1--",filter.getTableName());assertEquals("中文",filter.getTableComment());assertEquals("2026-10-01",filter.getParams().get("beginTime"));return List.of(table);});
        mvc.perform(get(PATH+"/tables").param("name","x%' OR 1=1--").param("comment","中文").param("from","2026-10-01").param("to","2026-10-05").param("sort","name").param("direction","asc")).andExpect(status().isOk());assertNull(com.github.pagehelper.PageHelper.getLocalPage());
        when(tables.selectDbTableList(any())).thenAnswer(invocation->{assertEquals("update_time desc, table_name asc",com.github.pagehelper.PageHelper.getLocalPage().getOrderBy());throw new org.springframework.dao.DataAccessResourceFailureException("private SQL");});
        mvc.perform(get(PATH+"/database-tables").param("sort","updatedAt")).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private SQL"))));assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @Test void missingResourcesAndBadStoredJsonHaveTypedSanitizedErrors() throws Exception {
        mvc.perform(get(PATH+"/tables/1")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("GENERATOR_TABLE_NOT_FOUND"));mvc.perform(get(PATH+"/tables/1/columns")).andExpect(status().isNotFound());
        table.setOptions("{private malformed");mvc.perform(get(PATH+"/tables/"+ID)).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("GENERATOR_CONFIGURATION_INVALID")).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));
        table.setOptions(null);mvc.perform(get(PATH+"/tables/"+ID)).andExpect(status().isOk()).andExpect(jsonPath("$.configuration.options.generateDetail").value(false));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
