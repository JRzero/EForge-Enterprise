package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.generator.mapper.GenTableMapper;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.rendering.GeneratorRenderingSnapshotLoader;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={GeneratorOutputController.class,GeneratorOutputService.class,GeneratorRenderingSnapshotLoader.class,
    PermissionService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,
    ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorSynchronizationControllerTest.Configuration.class})
class GeneratorOutputControllerTest {
    static final long ID=9007199254740993L;
    static final String BASE="/api/v1/tool/generator";
    @Autowired MockMvc mvc;
    @MockitoBean io.eforge.enterprise.generator.rendering.GeneratorCustomOutput custom;
    @MockitoBean GenTableMapper tables;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare(){actor(Set.of("tool:gen:preview","tool:gen:code"));}
    void actor(Set<String> permissions){var user=new SysUser(2L);user.setUserName("output_actor");user.setRoles(List.of());when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,permissions));}
    GenTable table(long id,String name){
        var table=new GenTable();table.setTableId(id);table.setTableName("quoted`表_"+id);table.setClassName(name);table.setTplCategory("crud");table.setTplWebType("element-plus-typescript");
        table.setPackageName("generated");table.setModuleName("test");table.setBusinessName(name.toLowerCase(Locale.ROOT));table.setFunctionName("中文输出");table.setFunctionAuthor("作者");table.setOptions("{}");table.setFormColNum(2);
        var key=new GenTableColumn();key.setColumnId(id);key.setTableId(id);key.setColumnName("id");key.setJavaField("id");key.setJavaType("Long");key.setColumnComment("编号");key.setIsPk("1");key.setIsList("1");key.setSort(0);
        var field=new GenTableColumn();field.setColumnId(id+1);field.setTableId(id);field.setColumnName("name");field.setJavaField("name");field.setJavaType("String");field.setColumnComment("中文名称");field.setIsPk("0");field.setIsList("1");field.setSort(1);
        table.setColumns(List.of(key,field));return table;
    }
    String body(String...ids){return "{\"tableIds\":["+Arrays.stream(ids).map(id->"\""+id+"\"").collect(java.util.stream.Collectors.joining(","))+"]}";}
    @Test void typedPreviewPreservesExactIdAndAllFilesWithoutLegacyObjects()throws Exception{
        when(tables.selectGenTableById(ID)).thenReturn(table(ID,"OutputEntry"));
        mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.tableId").value(Long.toString(ID))).andExpect(jsonPath("$.files.length()").value(11))
            .andExpect(jsonPath("$.files[0].template").value("vm/java/domain.java.vm")).andExpect(jsonPath("$.files[0].path").value("main/java/generated/domain/OutputEntry.java"))
            .andExpect(jsonPath("$.data").doesNotExist()).andExpect(jsonPath("$.params").doesNotExist());
        verify(tables).selectGenTableById(ID);verifyNoMoreInteractions(tables);
    }
    @Test void actualBatchArchiveRetainsBothFilesAndOneSharedIndex()throws Exception{
        when(tables.selectGenTableById(ID)).thenReturn(table(ID,"OutputEntry"));when(tables.selectGenTableById(ID+10)).thenReturn(table(ID+10,"OtherEntry"));
        var response=mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID,""+(ID+10))))
            .andExpect(status().isOk()).andExpect(content().contentType("application/zip")).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(header().string("Content-Disposition","attachment; filename=\"eforge-generated.zip\""))
            .andReturn().getResponse();
        var files=new LinkedHashMap<String,String>();try(var zip=new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(response.getContentAsByteArray()),java.nio.charset.StandardCharsets.UTF_8)){
            for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry())assertNull(files.put(entry.getName(),new String(zip.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)));
        }
        assertEquals(21,files.size());assertTrue(files.get("vue/types/api/index-bak.ts").contains("./test/outputentry"));assertTrue(files.get("vue/types/api/index-bak.ts").contains("./test/otherentry"));
        assertTrue(files.get("main/java/generated/domain/OutputEntry.java").contains("class OutputEntry"));assertTrue(files.get("main/java/generated/domain/OtherEntry.java").contains("class OtherEntry"));
        verify(tables).selectGenTableById(ID);verify(tables).selectGenTableById(ID+10);verifyNoMoreInteractions(tables);
    }
    @Test void anonymousAndNoRoleCannotReadMetadata()throws Exception{
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID))).andExpect(status().isUnauthorized());
        actor(Set.of());mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isForbidden());
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID))).andExpect(status().isForbidden());verifyNoInteractions(tables);
    }
    @Test void previewGrantCannotDownloadAndCodeGrantCannotPreview()throws Exception{
        actor(Set.of("tool:gen:preview"));mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID))).andExpect(status().isForbidden());
        actor(Set.of("tool:gen:code"));mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isForbidden());verifyNoInteractions(tables);
    }
    @Test void readListAndQueryAreInsufficientForOutput()throws Exception{
        actor(Set.of("tool:gen:list","tool:gen:query"));mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isForbidden());
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID))).andExpect(status().isForbidden());verifyNoInteractions(tables);
    }
    @ParameterizedTest @ValueSource(strings={"0","-1","+1","01","9223372036854775808","private","1 OR 1=1"})
    void invalidIdsFailBeforeMetadataReads(String id)throws Exception{
        mvc.perform(get(BASE+"/tables/"+id+"/preview")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(id))).andExpect(status().isBadRequest());verifyNoInteractions(tables);
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"tableIds\":null}","{\"tableIds\":[]}","{\"tableIds\":[null]}","{\"tableIds\":42}"})
    void invalidSelectionsAreRejectedBeforeSql(String input)throws Exception{
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(input)).andExpect(status().isBadRequest());verifyNoInteractions(tables);
    }
    @Test void duplicateAndOversizedSelectionsHaveNoPartialArchive()throws Exception{
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID,""+ID))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GENERATOR_SNAPSHOT_SELECTION_INVALID")).andExpect(header().doesNotExist("Content-Disposition"));
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(java.util.stream.LongStream.rangeClosed(1,101).mapToObj(Long::toString).toArray(String[]::new)))).andExpect(status().isBadRequest());verifyNoInteractions(tables);
    }
    @Test void missingAndUnavailableMetadataHaveSafeProblemDetails()throws Exception{
        mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isNotFound()).andExpect(content().contentTypeCompatibleWith("application/problem+json")).andExpect(jsonPath("$.code").value("GENERATOR_TABLE_NOT_FOUND"));
        when(tables.selectGenTableById(ID)).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private driver password"));
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID))).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.detail").value("Generator metadata cannot be read safely.")).andExpect(header().doesNotExist("Content-Disposition"));
    }
    @Test void unsafePathsAndCollisionsRemainProblemsWithoutPartialArchive()throws Exception{
        var first=table(ID,"OutputEntry");first.setModuleName("../private");when(tables.selectGenTableById(ID)).thenReturn(first);
        mvc.perform(get(BASE+"/tables/"+ID+"/preview")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GENERATOR_OUTPUT_PATH_INVALID"));
        first.setModuleName("test");var second=table(ID+10,"outputentry");second.setBusinessName("other");when(tables.selectGenTableById(ID+10)).thenReturn(second);
        mvc.perform(post(BASE+"/downloads").contentType("application/json").content(body(""+ID,""+(ID+10)))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GENERATOR_OUTPUT_COLLISION")).andExpect(header().doesNotExist("Content-Disposition"));
    }
    @Test void customOutputIsTypedAndCodePermissionIsRequiredBeforeSql()throws Exception{
        var result=new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.CustomOutputResult(List.of(new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.CustomOutputOutcome("main/java/generated/domain/OutputEntry.java",io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.State.CREATED)));
        when(tables.selectGenTableById(ID)).thenReturn(table(ID,"OutputEntry"));when(custom.write(any())).thenReturn(result);
        mvc.perform(post(BASE+"/tables/"+ID+"/custom-output")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.files[0].state").value("CREATED")).andExpect(jsonPath("$.data").doesNotExist());
        clearInvocations(tables,custom);actor(Set.of("tool:gen:preview"));
        mvc.perform(post(BASE+"/tables/"+ID+"/custom-output")).andExpect(status().isForbidden());verifyNoInteractions(tables,custom);
    }
    @Test void disabledCustomOutputRejectsBeforeMetadataRead()throws Exception{
        doThrow(new io.eforge.enterprise.common.exception.ApiFailure(403,"GENERATOR_CUSTOM_OUTPUT_DISABLED","Custom file output is disabled by server configuration.")).when(custom).requireEnabled();
        mvc.perform(post(BASE+"/tables/"+ID+"/custom-output")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("GENERATOR_CUSTOM_OUTPUT_DISABLED"));verifyNoInteractions(tables);
    }
    @Test void partialCustomFilesRemainInSafeStructuredProblem()throws Exception{
        var partial=new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.CustomOutputResult(List.of(new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.CustomOutputOutcome("main/java/generated/domain/OutputEntry.java",io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.State.CREATED),new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.CustomOutputOutcome("main/java/generated/mapper/OutputEntryMapper.java",io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.State.FAILED)));
        when(tables.selectGenTableById(ID)).thenReturn(table(ID,"OutputEntry"));when(custom.write(any())).thenThrow(new io.eforge.enterprise.generator.rendering.GeneratorCustomOutput.Failure(partial));
        mvc.perform(post(BASE+"/tables/"+ID+"/custom-output")).andExpect(status().isServiceUnavailable()).andExpect(content().contentType("application/problem+json"))
            .andExpect(jsonPath("$.code").value("GENERATOR_CUSTOM_OUTPUT_PARTIAL")).andExpect(jsonPath("$.output.files[0].state").value("CREATED")).andExpect(jsonPath("$.output.files[1].state").value("FAILED"));
    }}