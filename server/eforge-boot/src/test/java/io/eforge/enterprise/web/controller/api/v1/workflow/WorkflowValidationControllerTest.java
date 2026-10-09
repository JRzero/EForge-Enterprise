package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
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
import io.eforge.enterprise.workflow.api.WorkflowValidation;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={WorkflowValidationController.class,PermissionService.class,ApiExceptionHandler.class,
    ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,WorkflowValidationControllerTest.Configuration.class})
class WorkflowValidationControllerTest {
    static final String BODY="""
        {"bpmnXml":"<definitions/>","scenarios":[{"name":"approved","decisions":[{"taskKey":"review","approved":true}],"expectedEnd":"approvedEnd"}]}
        """;
    @Autowired MockMvc mvc;
    @MockitoBean WorkflowValidation validation;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare() { actor(Set.of("workflow:definition:validate")); }
    void actor(Set<String> grants) {
        var user=new SysUser(2L);user.setUserName("reviewer");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));
    }
    @Test void canonicalResultIsTypedAndExactSourceAndDecisionsReachValidator() throws Exception {
        when(validation.validate(any())).thenReturn(new WorkflowValidation.Result("leaveApproval","digest",
            List.of(new WorkflowValidation.ScenarioResult("approved",List.of("review"),"approvedEnd"))));
        mvc.perform(post("/api/v1/workflow/validation").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isOk()).andExpect(jsonPath("$.processKey").value("leaveApproval"))
            .andExpect(jsonPath("$.scenarios[0].endActivity").value("approvedEnd"))
            .andExpect(jsonPath("$.data").doesNotExist());
        verify(validation).validate(argThat(request -> request.bpmnXml().equals("<definitions/>")
            && request.scenarios().get(0).decisions().get(0).approved()));
    }
    @Test void rolelessAndAnonymousNeverReachEngine() throws Exception {
        actor(Set.of());
        mvc.perform(post("/api/v1/workflow/validation").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(post("/api/v1/workflow/validation").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/workflow/status")).andExpect(status().isUnauthorized());
        verifyNoInteractions(validation);
    }
    @Test void missingDecisionAndEmptyScenariosAreRejectedBeforeEngine() throws Exception {
        for(String body:List.of(BODY.replace(",\"approved\":true",""),"{\"bpmnXml\":\"x\",\"scenarios\":[]}",
            BODY.replace("\"decisions\":[{\"taskKey\":\"review\",\"approved\":true}]","\"decisions\":[null]"))) {
            mvc.perform(post("/api/v1/workflow/validation").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(validation);
    }
    @Test void engineFailureReturnsSafeProblemDetail() throws Exception {
        when(validation.validate(any())).thenThrow(new io.eforge.enterprise.common.exception.ApiFailure(400,"WORKFLOW_SCENARIO_FAILED","审批场景未通过。"));
        mvc.perform(post("/api/v1/workflow/validation").contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.code").value("WORKFLOW_SCENARIO_FAILED"));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
