package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.junit.jupiter.api.*;
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
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.generator.controller.GeneratorCreationLegacyController;
import io.eforge.enterprise.generator.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={GeneratorCreationController.class,GeneratorCreationLegacyController.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,GeneratorCreationControllerTest.Configuration.class})
class GeneratorCreationControllerTest {
    static final String PATH="/api/v1/tool/generator/creations";
    @Autowired MockMvc mvc;
    @MockitoBean GeneratorCreationCommand command;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    GeneratorCreationCommand.Creation created() {
        return new GeneratorCreationCommand.Creation(List.of(new GeneratorCreationExecution.Outcome("owned",GeneratorCreationExecution.State.CREATED,"GENERATOR_CREATE_CREATED")),
            GeneratorCreationCommand.ImportState.IMPORTED,List.of(new GeneratorCreationMetadataImport.Imported("owned","owned","9007199254740995",1)));
    }
    @BeforeEach void prepare(){actor(true);when(command.create(anyString(),anyString())).thenReturn(created());}
    void actor(boolean admin){
        var user=new SysUser(2L);user.setUserName("creator");
        var role=new SysRole();role.setRoleKey(admin?"admin":"ordinary");user.setRoles(List.of(role));
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,admin?Set.of():Set.of("tool:gen:import","tool:gen:edit")));
    }
    @Test void originalAdminWithoutImportGrantReturnsCreatedAndExactStringId() throws Exception {
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"CREATE TABLE owned(id bigint)\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.importState").value("IMPORTED"))
            .andExpect(jsonPath("$.imported[0].id").value("9007199254740995")).andExpect(jsonPath("$.code").doesNotExist());
        verify(command).create("CREATE TABLE owned(id bigint)","eforge-react");
    }
    @Test void ordinaryImportAndEditGrantsCannotCreateOnEitherRoute() throws Exception {
        actor(false);
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"CREATE TABLE owned(id bigint)\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/tool/gen/createTable").param("sql","CREATE TABLE owned(id bigint)").param("tplWebType","element-ui")).andExpect(status().isForbidden());
        verifyNoInteractions(command);
    }
    @Test void anonymousCannotCreate() throws Exception {
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"CREATE TABLE owned(id bigint)\"}")).andExpect(status().isUnauthorized());
        verifyNoInteractions(command);
    }
    @Test void invalidBodyAndTemplateNeverReachCreation() throws Exception {
        for(String body:List.of("{}","{\"sql\":\" \"}","{\"sql\":\"x\",\"template\":\"unknown\"}","{\"sql\":")){
            mvc.perform(post(PATH).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(command);
    }
    @Test void partialDdlProblemRetainsAllOutcomesAndDoesNotPretendRollback() throws Exception {
        var partial=new GeneratorCreationCommand.Creation(List.of(
            new GeneratorCreationExecution.Outcome("first",GeneratorCreationExecution.State.CREATED,"GENERATOR_CREATE_CREATED"),
            new GeneratorCreationExecution.Outcome("second",GeneratorCreationExecution.State.UNCONFIRMED,"GENERATOR_CREATE_UNCONFIRMED"),
            new GeneratorCreationExecution.Outcome("third",GeneratorCreationExecution.State.UNATTEMPTED,"GENERATOR_CREATE_NOT_ATTEMPTED")),
            GeneratorCreationCommand.ImportState.UNATTEMPTED,List.of());
        when(command.create(anyString(),anyString())).thenThrow(new GeneratorCreationCommand.Failure(503,"GENERATOR_CREATE_UNCONFIRMED","Review retained table outcomes.",partial));
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"x\"}"))
            .andExpect(status().isServiceUnavailable()).andExpect(content().contentType("application/problem+json"))
            .andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.code").value("GENERATOR_CREATE_UNCONFIRMED"))
            .andExpect(jsonPath("$.creation.physical[0].state").value("CREATED"))
            .andExpect(jsonPath("$.creation.physical[1].state").value("UNCONFIRMED"))
            .andExpect(jsonPath("$.creation.physical[2].state").value("UNATTEMPTED"))
            .andExpect(jsonPath("$.creation.importState").value("UNATTEMPTED")).andExpect(jsonPath("$.instance").value(PATH));
    }
    @Test void legacyUsesSameCommandAndPreservesAjaxBoundary() throws Exception {
        mvc.perform(post("/tool/gen/createTable").param("sql","CREATE TABLE owned(id bigint)").param("tplWebType","element-plus-typescript"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.imported[0].id").value("9007199254740995"));
        verify(command).create("CREATE TABLE owned(id bigint)","element-plus-typescript");
    }
    @Test void importFailureExposesRetainedPhysicalTablesOnBothRoutes() throws Exception {
        var partial=new GeneratorCreationCommand.Creation(created().physical(),GeneratorCreationCommand.ImportState.FAILED,List.of());
        when(command.create(anyString(),anyString())).thenThrow(new GeneratorCreationCommand.Failure(500,"GENERATOR_IMPORT_FAILED","Created table metadata could not be saved.",partial));
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"x\"}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.creation.importState").value("FAILED")).andExpect(jsonPath("$.creation.physical[0].state").value("CREATED"));
        mvc.perform(post("/tool/gen/createTable").param("sql","x").param("tplWebType","element-ui"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.failureCode").value("GENERATOR_IMPORT_FAILED"))
            .andExpect(jsonPath("$.data.physical[0].state").value("CREATED"));
    }
    @Test void preflightFailureIsSafeOnCanonicalAndLegacyRoutes() throws Exception {
        when(command.create(anyString(),anyString())).thenThrow(new ApiFailure(400,"GENERATOR_CREATE_SQL_INVALID","The complete table creation batch is invalid."));
        mvc.perform(post(PATH).contentType("application/json").content("{\"sql\":\"private input\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GENERATOR_CREATE_SQL_INVALID")).andExpect(jsonPath("$.creation").doesNotExist());
        mvc.perform(post("/tool/gen/createTable").param("sql","private input").param("tplWebType","element-ui"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.failureCode").value("GENERATOR_CREATE_SQL_INVALID"))
            .andExpect(jsonPath("$.msg").value("The complete table creation batch is invalid."));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
