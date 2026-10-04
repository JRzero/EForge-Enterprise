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
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={DictionaryController.class,DictionaryService.class,PermissionService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,DictionaryControllerTest.Configuration.class})
class DictionaryControllerTest
{
    static final String TYPES="/api/v1/system/dictionaries",ENTRIES="/api/v1/system/dictionary-entries";
    static final String TYPE_BODY="{\"name\":\"Type\",\"code\":\"sample_type\",\"status\":\"0\",\"remark\":\"\"}";
    static final String ENTRY_BODY="{\"dictionaryId\":\"1\",\"label\":\"Label\",\"value\":\"0\",\"sort\":2,\"style\":\"PRIMARY\",\"cssClass\":\"\",\"defaultEntry\":true,\"status\":\"0\",\"remark\":\"\"}";
    @Autowired MockMvc mvc;
    @MockitoBean SysDictTypeMapper types;
    @MockitoBean SysDictDataMapper entries;
    @MockitoBean DictionaryMutationMapper writes;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean DictionaryCache cache;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    SysDictType type;SysDictData entry;
    @BeforeEach void prepare()
    {
        actor(Set.of("*:*:*"));when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);
        type=new SysDictType();type.setDictId(1L);type.setDictName("Type");type.setDictType("sample_type");type.setStatus("1");type.setRemark("old");
        entry=new SysDictData();entry.setDictCode(2L);entry.setDictType("sample_type");entry.setDictLabel("Label");entry.setDictValue("0");entry.setDictSort(2L);entry.setListClass("primary");entry.setIsDefault("Y");entry.setStatus("0");
        when(types.selectDictTypeById(1L)).thenReturn(type);when(types.selectDictTypeByType("sample_type")).thenReturn(type);when(types.selectDictTypeAll()).thenReturn(List.of(type));when(types.selectDictTypeList(any())).thenReturn(List.of(type));
        when(entries.selectDictDataById(2L)).thenReturn(entry);when(entries.selectDictDataByType("sample_type")).thenReturn(List.of(entry));when(entries.selectDictDataList(any())).thenReturn(List.of(entry));
        when(writes.insertType(any())).thenAnswer(call->{SysDictType row=call.getArgument(0);row.setDictId(9007199254740993L);when(types.selectDictTypeById(row.getDictId())).thenReturn(row);return 1;});
        when(writes.insertEntry(any())).thenAnswer(call->{SysDictData row=call.getArgument(0);row.setDictCode(9007199254740993L);when(entries.selectDictDataById(row.getDictCode())).thenReturn(row);return 1;});
    }
    void actor(Set<String> grants) {var user=new SysUser(2L);user.setUserName("operator");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void concretePagingAndOptionsNeverExposeCompatibilityEntities() throws Exception
    {mvc.perform(get(TYPES)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("1")).andExpect(jsonPath("$.items[0].dictId").doesNotExist()).andExpect(jsonPath("$.items[0].params").doesNotExist());mvc.perform(get(ENTRIES+"?dictionaryId=1")).andExpect(jsonPath("$.items[0].style").value("PRIMARY")).andExpect(jsonPath("$.items[0].dictionaryId").value("1"));Assertions.assertNull(com.github.pagehelper.PageHelper.getLocalPage());}
    @Test void authenticatedConsumersCanReadOptionsAndLookupWithoutManagementGrants() throws Exception
    {actor(Set.of());mvc.perform(get(TYPES+"/options")).andExpect(status().isOk());mvc.perform(get(TYPES+"/lookup/sample_type")).andExpect(status().isOk()).andExpect(jsonPath("$[0].label").value("Label")).andExpect(jsonPath("$[0].createBy").doesNotExist());verify(cache).put("sample_type",List.of(entry));mvc.perform(get(TYPES+"/lookup/missing_type")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));}
    @Test void anonymousLookupIsRejected() throws Exception
    {when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(TYPES+"/lookup/sample_type")).andExpect(status().isUnauthorized());verify(cache,never()).put(any(),any());}
    @Test void everyManagementOperationRetainsOriginalPermission() throws Exception
    {
        actor(Set.of());mvc.perform(get(TYPES)).andExpect(status().isForbidden());mvc.perform(get(TYPES+"/1")).andExpect(status().isForbidden());mvc.perform(post(TYPES).contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isForbidden());mvc.perform(put(TYPES+"/1").contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isForbidden());mvc.perform(delete(TYPES).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}")).andExpect(status().isForbidden());mvc.perform(post(TYPES+"/cache/refresh")).andExpect(status().isForbidden());mvc.perform(post(TYPES+"/export")).andExpect(status().isForbidden());
        mvc.perform(get(ENTRIES+"?dictionaryId=1")).andExpect(status().isForbidden());mvc.perform(get(ENTRIES+"/2")).andExpect(status().isForbidden());mvc.perform(post(ENTRIES).contentType(MediaType.APPLICATION_JSON).content(ENTRY_BODY)).andExpect(status().isForbidden());mvc.perform(put(ENTRIES+"/2").contentType(MediaType.APPLICATION_JSON).content(ENTRY_BODY)).andExpect(status().isForbidden());mvc.perform(delete(ENTRIES).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\"]}")).andExpect(status().isForbidden());mvc.perform(post(ENTRIES+"/export?dictionaryId=1")).andExpect(status().isForbidden());verifyNoInteractions(writes);
    }
    @Test void exactLargeIdsAndCreationLocations() throws Exception
    {mvc.perform(post(TYPES).contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isCreated()).andExpect(header().string("Location",TYPES+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993"));mvc.perform(post(ENTRIES).contentType(MediaType.APPLICATION_JSON).content(ENTRY_BODY)).andExpect(status().isCreated()).andExpect(header().string("Location",ENTRIES+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993"));}
    @ParameterizedTest @ValueSource(strings={"{}","null","{\"name\":\"Type\",\"code\":\"UPPER\",\"status\":\"0\"}","{\"name\":\"Type\",\"code\":\"valid_type\",\"status\":\"2\"}"})
    void invalidTypesNeverWrite(String body) throws Exception {mvc.perform(post(TYPES).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verifyNoInteractions(writes);}
    @Test void invalidEntryStyleCssAndOverflowCannotReachWrite() throws Exception
    {for(String body:List.of(ENTRY_BODY.replace("PRIMARY","HTML"),ENTRY_BODY.replace("\"cssClass\":\"\"","\"cssClass\":\"<script>\""),ENTRY_BODY.replace("\"1\"","\"9223372036854775808\""),ENTRY_BODY.replace("\"sort\":2","\"sort\":-1")))mvc.perform(post(ENTRIES).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verifyNoInteractions(writes);}
    @Test void malformedPagingDateRangeAndMissingTargetsAreSafeProblems() throws Exception
    {mvc.perform(get(TYPES+"?pageSize=101")).andExpect(status().isBadRequest());mvc.perform(get(TYPES+"?from=2026-10-05&to=2026-10-04")).andExpect(status().isBadRequest());mvc.perform(get(TYPES+"/999")).andExpect(status().isNotFound());mvc.perform(get(ENTRIES+"/999")).andExpect(status().isNotFound());mvc.perform(get(ENTRIES+"?dictionaryId=999")).andExpect(status().isNotFound());}
    @Test void renameCascadesDataClearsRemarkAndInvalidatesBothCodes() throws Exception
    {mvc.perform(put(TYPES+"/1").contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY.replace("sample_type","renamed_type"))).andExpect(status().isNoContent());verify(entries).updateDictDataType("sample_type","renamed_type");verify(types).updateDictType(argThat(row->row.getRemark().equals("") && row.getUpdateBy().equals("operator")));verify(cache).invalidate("sample_type");verify(cache).invalidate("renamed_type");}
    @Test void duplicateTypeAndDatabaseUniqueRacesRollBack() throws Exception
    {when(types.checkDictTypeUnique("sample_type")).thenReturn(type);mvc.perform(post(TYPES).contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isConflict());verifyNoInteractions(writes);when(types.checkDictTypeUnique(anyString())).thenReturn(null);doThrow(new org.springframework.dao.DuplicateKeyException("race")).when(writes).insertType(any());mvc.perform(post(TYPES).contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DICTIONARY_CODE_EXISTS"));verify(transactions,times(2)).rollback(any());}
    @Test void batchTypeDeletionChecksEveryChildBeforeAnyDeletion() throws Exception
    {var second=new SysDictType();second.setDictId(3L);second.setDictType("used_type");when(types.selectDictTypeById(3L)).thenReturn(second);when(entries.countDictDataByType("used_type")).thenReturn(1);mvc.perform(delete(TYPES).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"3\"]}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DICTIONARY_HAS_ENTRIES"));verify(types,never()).deleteDictTypeById(any());verify(cache,never()).invalidate(any());}
    @Test void missingBatchEntryPreventsPartialDeletion() throws Exception
    {mvc.perform(delete(ENTRIES).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\",\"999\"]}")).andExpect(status().isNotFound());verify(entries,never()).deleteDictDataById(any());}
    @Test void duplicateValuesAndDefaultsRemainAllowedAndMovingEntriesInvalidatesBothTypes() throws Exception
    {mvc.perform(post(ENTRIES).contentType(MediaType.APPLICATION_JSON).content(ENTRY_BODY)).andExpect(status().isCreated());var second=new SysDictType();second.setDictId(3L);second.setDictType("other_type");when(types.selectDictTypeById(3L)).thenReturn(second);mvc.perform(put(ENTRIES+"/2").contentType(MediaType.APPLICATION_JSON).content(ENTRY_BODY.replace("\"dictionaryId\":\"1\"","\"dictionaryId\":\"3\""))).andExpect(status().isNoContent());verify(entries).updateDictData(argThat(row->row.getDictType().equals("other_type") && row.getRemark().equals("") && row.getCssClass().equals("")));verify(cache).invalidate("other_type");}
    @Test void redisFailureRollsBackTheDatabaseTransaction() throws Exception
    {doThrow(new ApiFailure(503,"DICTIONARY_CACHE_UNAVAILABLE","Unavailable")).when(cache).invalidate(any());mvc.perform(put(TYPES+"/1").contentType(MediaType.APPLICATION_JSON).content(TYPE_BODY)).andExpect(status().isServiceUnavailable());verify(transactions).rollback(any());verify(transactions,never()).commit(any());}
    @Test void cacheRefreshReloadsActiveEntriesAndEmptyTypes() throws Exception
    {actor(Set.of("system:dict:remove"));mvc.perform(post(TYPES+"/cache/refresh")).andExpect(status().isNoContent());var order=inOrder(mutex,cache,entries);order.verify(mutex).lockRoot();order.verify(cache).clear();order.verify(entries).selectDictDataByType("sample_type");order.verify(cache).put("sample_type",List.of(entry));}
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
