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
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.domain.SysNotice;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={NoticeController.class,NoticeImageController.class,NoticeService.class,PermissionService.class,ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,NoticeControllerTest.Configuration.class})
class NoticeControllerTest
{
    static final String PATH="/api/v1/system/notices";
    static final String BODY="{\"title\":\"公告\",\"type\":\"2\",\"content\":\"<p><strong>中文</strong></p>\",\"status\":\"0\",\"remark\":\"\"}";
    @Autowired MockMvc mvc;
    @MockitoBean SysNoticeMapper notices;
    @MockitoBean SysNoticeReadMapper reads;
    @MockitoBean NoticeMutationMapper writes;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @MockitoBean NoticeImageStore images;
    SysNotice row;
    @BeforeEach void prepare()
    {
        actor(Set.of("*:*:*")); when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutex.lockRoot()).thenReturn(100L); row=row(1L);
        when(notices.selectNoticeById(1L)).thenReturn(row); when(notices.selectNoticeList(any())).thenReturn(List.of(row));
        when(reads.selectNoticeListWithReadStatus(2L,5)).thenReturn(List.of(row));
        when(writes.insert(any())).thenAnswer(call -> {SysNotice created=call.getArgument(0);created.setNoticeId(9L);when(notices.selectNoticeById(9L)).thenReturn(created);return 1;});
    }
    private static SysNotice row(long id)
    {var row=new SysNotice();row.setNoticeId(id);row.setNoticeTitle("公告");row.setNoticeType("2");row.setNoticeContent("<p><strong>中文</strong></p>");row.setStatus("0");row.setCreateBy("admin");return row;}
    void actor(Set<String> grants)
    {var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}

    @Test void listIsTypedAndFiltersRemainBehindBoundary() throws Exception
    {
        mvc.perform(get(PATH).param("author","admin").param("type","2").param("title","公告"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("1"))
                .andExpect(jsonPath("$.items[0].content").value(row.getNoticeContent())).andExpect(jsonPath("$.rows").doesNotExist())
                .andExpect(jsonPath("$.items[0].params").doesNotExist());
        verify(notices).selectNoticeList(argThat(filter -> filter.getCreateBy().equals("admin") && filter.getNoticeType().equals("2") && filter.getNoticeTitle().equals("公告")));
        Assertions.assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @Test void consumersRetainLoginOnlyDetailFeedAndCurrentUserReadState() throws Exception
    {
        actor(Set.of()); row.setStatus("1");
        mvc.perform(get(PATH+"/1")).andExpect(status().isOk());
        mvc.perform(get(PATH+"/feed")).andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.items[0].read").value(false)).andExpect(jsonPath("$.items[0].content").doesNotExist());
        mvc.perform(post(PATH+"/read").contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"1\"]}")).andExpect(status().isNoContent());
        verify(reads).insertNoticeReadBatch(eq(2L),aryEq(new Long[]{1L}));
        when(tokens.getLoginUser(any())).thenReturn(null);
        for(String path:List.of("/1","/feed"))mvc.perform(get(PATH+path)).andExpect(status().isUnauthorized());
        mvc.perform(post(PATH+"/read").contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}")).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @ValueSource(strings={"list","create","update","delete","readers"})
    void everyManagementBoundaryRequiresItsOriginalGrant(String operation) throws Exception
    {
        actor(Set.of());
        var request=switch(operation){case "create"->post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY);
            case "update"->put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY);
            case "delete"->delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}");
            case "readers"->get(PATH+"/1/readers");default->get(PATH);};
        mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }
    @Test void createReturnsLocationAndPreservesRichText() throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated())
                .andExpect(header().string("Location",PATH+"/9")).andExpect(jsonPath("$.content").value(row.getNoticeContent()));
        verify(writes).insert(argThat(created -> created.getCreateBy().equals("reader") && created.getRemark().equals("")));
    }
    @Test void updateExplicitlyClearsContentAndRemark() throws Exception
    {
        mvc.perform(put(PATH+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY.replace(row.getNoticeContent(),"")))
                .andExpect(status().isNoContent());
        verify(writes).update(argThat(updated -> updated.getNoticeContent().equals("") && updated.getRemark().equals("") && updated.getUpdateBy().equals("reader")));
    }
    @Test void missingBatchMemberPreventsReadAndNoticeDeletion() throws Exception
    {
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"999\"]}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOTICE_NOT_FOUND"));
        verify(reads,never()).deleteByNoticeIds(any()); verify(notices,never()).deleteNoticeByIds(any()); verify(transactions).rollback(any());
    }
    @Test void deleteCleansReadRowsAndNoticeRowsInOneTransaction() throws Exception
    {
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"1\"]}"))
                .andExpect(status().isNoContent());
        var order=inOrder(mutex,reads,notices,transactions);order.verify(mutex).lockRoot();order.verify(notices).selectNoticeById(1L);
        order.verify(reads).deleteByNoticeIds(aryEq(new Long[]{1L}));order.verify(notices).deleteNoticeByIds(aryEq(new Long[]{1L}));order.verify(transactions).commit(any());
    }
    @Test void markReadPrevalidatesTheEntireBatch() throws Exception
    {
        mvc.perform(post(PATH+"/read").contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"999\"]}"))
                .andExpect(status().isNotFound());verify(reads,never()).insertNoticeReadBatch(anyLong(),any());verify(transactions).rollback(any());
    }
    @Test void readersProjectExactIdsAndClearPaging() throws Exception
    {
        var time=java.sql.Timestamp.from(java.time.Instant.parse("2026-10-05T00:00:00Z"));
        when(writes.selectReaders(1L,"reader")).thenReturn(List.of(new NoticeMutationMapper.ReaderRow(9007199254740993L,"reader","读者","部门","123",time)));
        mvc.perform(get(PATH+"/1/readers").param("search","reader")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].userId").value("9007199254740993"))
                .andExpect(jsonPath("$.items[0].readAt").value("2026-10-05T00:00:00Z")).andExpect(jsonPath("$.items[0].password").doesNotExist());
        Assertions.assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @ParameterizedTest @ValueSource(strings={"?page=0","?pageSize=101","?type=3","/0","/9223372036854775808","/1/readers?page=0"})
    void malformedRequestsUseProblemDetails(String path) throws Exception
    {mvc.perform(get(PATH+path)).andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"));}
    @Test void invalidTitlesAndTypesNeverWrite() throws Exception
    {
        for(String invalid:List.of(BODY.replace("公告","<script>x</script>"),BODY.replace("\"2\"","\"3\""),BODY.replace("公告","x".repeat(51)),BODY.replace("\"0\"","null")))
            mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        verifyNoInteractions(writes);
    }
    @ParameterizedTest @ValueSource(strings={"system:notice:add","system:notice:edit"})
    void imageUploadRequiresAnAuthorGrantAndReturnsTypedLocation(String grant) throws Exception
    {
        actor(Set.of(grant));
        when(images.upload(any())).thenReturn(new NoticeImageStore.StoredImage("/profile/upload/notices/test.png"));
        mvc.perform(multipart(PATH+"/images").file("file",new byte[]{1,2})).andExpect(status().isCreated())
                .andExpect(header().string("Location","/profile/upload/notices/test.png"))
                .andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.imageUrl").value("/profile/upload/notices/test.png"))
                .andExpect(jsonPath("$.code").doesNotExist());
    }
    @Test void readOnlyAndUnauthenticatedImageUploadsNeverReachStorage() throws Exception
    {
        actor(Set.of("system:notice:list"));
        mvc.perform(multipart(PATH+"/images").file("file",new byte[]{1})).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(multipart(PATH+"/images").file("file",new byte[]{1})).andExpect(status().isUnauthorized());
        verifyNoInteractions(images);
    }
    @TestConfiguration static class Configuration
    { @Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}
      @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());} }
}
