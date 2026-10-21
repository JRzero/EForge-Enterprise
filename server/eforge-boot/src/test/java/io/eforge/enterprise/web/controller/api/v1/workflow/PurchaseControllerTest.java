package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.workflow.api.WorkflowPurchases;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={PurchaseController.class,PermissionService.class,ApiExceptionHandler.class,
    ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,WorkflowValidationControllerTest.Configuration.class})
class PurchaseControllerTest {
    static final String ID="00000000-0000-0000-0000-000000000001",ROOT="/api/v1/samples/purchases";
    static final String CREATE="{\"commandId\":\""+ID+"\",\"actor\":\"1\",\"content\":{\"title\":\"采购\",\"reason\":\"需要\",\"approverId\":\"1\",\"items\":[{\"id\":\"a\",\"name\":\"键盘\",\"unit\":\"件\",\"quantity\":\"3\",\"unitPrice\":\"0.10\"}]}}";
    static final String COMMAND="{\"commandId\":\""+ID+"\",\"expectedRevision\":\"9007199254740993\",\"comment\":\"同意\"}";
    @Autowired MockMvc mvc;
    @MockitoBean WorkflowPurchases purchases;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    WorkflowPurchases.Purchase row;
    void actor(Set<String> permissions){var user=new SysUser();user.setUserId(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,permissions));}
    @BeforeEach void prepare(){actor(Set.of("*:*:*"));row=new WorkflowPurchases.Purchase(ID,"2","1","采购","需要","0.30","DRAFT",9007199254740993L,null,null,Instant.EPOCH);}
    @Test void createUsesServerActorAndReturnsCreatedWithExactDecimalAndRevision()throws Exception{
        actor(Set.of("sample:purchase:write"));when(purchases.create(eq(ID),any(),eq("2"))).thenReturn(row);
        mvc.perform(post(ROOT).contentType(MediaType.APPLICATION_JSON).content(CREATE)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.revision").value("9007199254740993")).andExpect(jsonPath("$.total").value("0.30"));
        verify(purchases).create(eq(ID),any(),eq("2"));
        mvc.perform(post(ROOT+"/"+ID+"/decision").contentType(MediaType.APPLICATION_JSON).content("{\"command\":"+COMMAND+",\"approved\":true}")).andExpect(status().isForbidden());
    }
    @Test void decisionUsesSeparatePermissionAndExactRevision()throws Exception{
        actor(Set.of("sample:purchase:approve"));when(purchases.decide(eq(ID),any(),eq(true),eq("2"))).thenReturn(row);
        mvc.perform(post(ROOT+"/"+ID+"/decision").contentType(MediaType.APPLICATION_JSON).content("{\"command\":"+COMMAND+",\"approved\":true}")).andExpect(status().isOk());
        verify(purchases).decide(ID,new WorkflowPurchases.Command(ID,9007199254740993L,"同意"),true,"2");
        mvc.perform(post(ROOT+"/"+ID+"/withdrawal").contentType(MediaType.APPLICATION_JSON).content(COMMAND)).andExpect(status().isForbidden());
    }
    @Test void listPreservesPagingAndActor()throws Exception{
        actor(Set.of("sample:purchase:list"));when(purchases.list("mine","DRAFT",2,10,"2")).thenReturn(new WorkflowPurchases.Page<>(List.of(row),11));
        mvc.perform(get(ROOT).param("page","2").param("status","DRAFT")).andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(11)).andExpect(jsonPath("$.page").value(2));
    }
    @Test void invalidInputAndNoRoleNeverReachService()throws Exception{
        mvc.perform(post(ROOT).contentType(MediaType.APPLICATION_JSON).content(CREATE.replace("\"采购\"","\"\""))).andExpect(status().isBadRequest());
        mvc.perform(post(ROOT+"/"+ID+"/submission").contentType(MediaType.APPLICATION_JSON).content(COMMAND.replace("9007199254740993","9999999999999999999"))).andExpect(status().isBadRequest());
        actor(Set.of());mvc.perform(get(ROOT)).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(ROOT)).andExpect(status().isUnauthorized());
        verifyNoInteractions(purchases);
    }
}
