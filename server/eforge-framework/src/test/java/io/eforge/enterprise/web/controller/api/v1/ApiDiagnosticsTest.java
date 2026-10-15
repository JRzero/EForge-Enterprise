package io.eforge.enterprise.web.controller.api.v1;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.ApiRoutingExceptionResolver;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.ProblemDetailJacksonMixin;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** A GET without operation auditing must still leave a private, correlatable failure record. */
class ApiDiagnosticsTest
{
    private final Logger logger = (Logger) LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();
    private final Logger routingLogger = (Logger) LoggerFactory.getLogger(ApiRoutingExceptionResolver.class);
    private MockMvc mvc;

    @BeforeEach void setup()
    {
        events.start(); logger.addAppender(events); routingLogger.addAppender(events);
        mvc = MockMvcBuilders.standaloneSetup(new Controller()).setControllerAdvice(new ApiExceptionHandler()).build();
    }

    @AfterEach void cleanup() {logger.detachAppender(events); routingLogger.detachAppender(events); events.stop();}

    @Test void unexpectedGetErrorHasServerGeneratedCorrelationAndRedactedDiagnostic() throws Exception
    {
        var response = mvc.perform(get("/api/v1/diagnostics/fail")
                .header("X-Request-ID", "forged-private-value").param("password", "private-query-secret"))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
        var body = new ObjectMapper().readTree(response.getContentAsString());
        String id = body.path("requestId").asText();
        assertThat(id).matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}");
        assertThat(response.getHeader("X-Request-ID")).isEqualTo(id);
        assertThat(events.list).hasSize(1);
        var event = events.list.get(0);
        assertThat(event.getLevel().toString()).isEqualTo("ERROR");
        assertThat(event.getFormattedMessage()).contains(id, "java.lang.IllegalStateException", "java.lang.IllegalArgumentException", "Controller.fail");
        assertThat(event.getThrowableProxy()).isNull();
        assertThat(event.getFormattedMessage() + response.getContentAsString())
                .doesNotContain("driver-password-secret", "sql-payload-secret", "private-query-secret", "forged-private-value");
    }

    @Test void expectedErrorsRetainTheirStatusAndHaveDistinctCorrelationsWithoutErrorDiagnostics() throws Exception
    {
        var business = mvc.perform(get("/api/v1/diagnostics/business"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXPECTED_CONFLICT"))
                .andExpect(jsonPath("$.requestId").isString()).andReturn().getResponse();
        var invalid = mvc.perform(get("/api/v1/diagnostics/value").param("value", "private-query-secret"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.requestId").isString()).andReturn().getResponse();
        assertThat(business.getHeader("X-Request-ID")).isNotBlank().isNotEqualTo(invalid.getHeader("X-Request-ID"));
        assertThat(invalid.getContentAsString()).doesNotContain("private-query-secret");
        assertThat(events.list).isEmpty();
    }

    @Test void springSerializationAndRoutingFailuresAlsoLeavePrivateDiagnostics() throws Exception
    {
        var response = mvc.perform(get("/api/v1/diagnostics/serialize"))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("HTTP_500"))
                .andReturn().getResponse();
        var routingRequest = new MockHttpServletRequest("GET", "/api/v1/diagnostics/routing");
        var routingResponse = new MockHttpServletResponse();
        new ApiRoutingExceptionResolver(problemMapper()).resolveException(routingRequest, routingResponse, null,
                new ErrorResponseException(HttpStatus.SERVICE_UNAVAILABLE,
                        new IllegalStateException("private-routing-secret")));
        assertThat(routingResponse.getStatus()).isEqualTo(503);
        assertThat(events.list).hasSize(2);
        assertThat(events.list.get(0).getFormattedMessage()).contains(response.getHeader("X-Request-ID"), "HttpMessageNotWritableException");
        var routingLog = new ObjectMapper().readTree(events.list.get(1).getFormattedMessage());
        assertThat(routingLog.path("status").asInt()).isEqualTo(503);
        assertThat(routingLog.path("requestId").asText()).isEqualTo(routingResponse.getHeader("X-Request-ID"));
        assertThat(events.list).allSatisfy(event -> {
            assertThat(event.getThrowableProxy()).isNull();
            assertThat(event.getFormattedMessage()).doesNotContain("private-serialization-secret", "private-routing-secret");
        });
    }

    @Test void securityAndRoutingClientErrorsUseTheSameCorrelationContract() throws Exception
    {
        var request = new MockHttpServletRequest("GET", "/api/v1/private");
        request.addHeader("X-Request-ID", "forged-id");
        var denied = new MockHttpServletResponse();
        new ApiSecurityProblemHandler(problemMapper()).reject(request, denied,
                new ApiFailure(401, "AUTHENTICATION_REQUIRED", "Authentication is required."));
        var deniedBody = new ObjectMapper().readTree(denied.getContentAsString());
        assertThat(denied.getHeader("X-Request-ID")).isEqualTo(deniedBody.path("requestId").asText()).isNotEqualTo("forged-id");
        assertThat(denied.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
        var notFound = new MockHttpServletResponse();
        new ApiRoutingExceptionResolver(problemMapper()).resolveException(request, notFound, null,
                new ErrorResponseException(HttpStatus.NOT_FOUND));
        assertThat(notFound.getHeader("X-Request-ID")).isEqualTo(denied.getHeader("X-Request-ID"));
        assertThat(new ObjectMapper().readTree(notFound.getContentAsString()).path("requestId").asText())
                .isEqualTo(denied.getHeader("X-Request-ID"));
        assertThat(events.list).isEmpty();
    }

    @Test void cyclicCausesAndHostileStackFramesCannotFloodOrForgeDiagnostics() throws Exception
    {
        var first = new IllegalStateException("secret-cause");
        var second = new IllegalArgumentException("secret-cause");
        first.initCause(second); second.initCause(first);
        var frames = new java.util.ArrayList<StackTraceElement>();
        frames.add(new StackTraceElement("io.eforge.enterprise.Forged\nstatus=200", "attack", "private-file", 1));
        frames.add(new StackTraceElement("io.eforge.enterprise.Safe", "attack\nstatus=200", "private-file", 1));
        for (int i = 0; i < 30; i++) frames.add(new StackTraceElement("io.eforge.enterprise.Safe", "method", "private-file", i));
        first.setStackTrace(frames.toArray(StackTraceElement[]::new));
        new ApiExceptionHandler().unexpected(first, new MockHttpServletRequest("GET", "/api/v1/diagnostics/cycle"));
        assertThat(events.list).hasSize(1);
        var event = events.list.get(0);
        var log = new ObjectMapper().readTree(event.getFormattedMessage());
        assertThat(log.path("errors").size()).isEqualTo(2);
        assertThat(log.path("errors").get(0).path("locations").size()).isLessThanOrEqualTo(8);
        assertThat(event.getFormattedMessage()).doesNotContain("Forged", "attack", "secret-cause", "private-file", "\n");
        assertThat(event.getThrowableProxy()).isNull();
    }

    @Test void longCauseChainsAreBoundedAndTypedServerFailuresAreDiagnosable() throws Exception
    {
        Exception chain = new IllegalArgumentException("private-deep-secret");
        for (int i = 0; i < 8; i++) chain = new IllegalStateException("private-chain-secret", chain);
        var handler = new ApiExceptionHandler();
        handler.unexpected(chain, new MockHttpServletRequest("GET", "/api/v1/diagnostics/long"));
        var log = new ObjectMapper().readTree(events.list.get(0).getFormattedMessage());
        assertThat(log.path("errors").size()).isEqualTo(4);
        var response = handler.business(new ApiFailure(500, "STORAGE_CORRUPT", "Stored data cannot be read."),
                new MockHttpServletRequest("GET", "/api/v1/diagnostics/storage"));
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(events.list.get(1).getFormattedMessage()).contains("STORAGE_CORRUPT", response.getHeaders().getFirst("X-Request-ID"));
        handler.business(new ApiFailure(503, "WORKFLOW_DISABLED", "Workflow is disabled."),
                new MockHttpServletRequest("GET", "/api/v1/diagnostics/disabled"));
        assertThat(events.list.get(2).getLevel().toString()).isEqualTo("WARN");
        assertThat(events.list).allSatisfy(event -> assertThat(event.getFormattedMessage())
                .doesNotContain("private-deep-secret", "private-chain-secret"));
    }

    private static ObjectMapper problemMapper()
    {
        return new ObjectMapper().addMixIn(ProblemDetail.class, ProblemDetailJacksonMixin.class);
    }

    @RestController static class Controller
    {
        @GetMapping("/api/v1/diagnostics/fail") String fail()
        {
            throw new IllegalStateException("driver-password-secret", new IllegalArgumentException("sql-payload-secret"));
        }
        @GetMapping("/api/v1/diagnostics/business") String business()
        {
            throw new ApiFailure(409, "EXPECTED_CONFLICT", "The operation conflicts with current state.");
        }
        @GetMapping("/api/v1/diagnostics/value") int value(@RequestParam Integer value) {return value;}
        @GetMapping("/api/v1/diagnostics/serialize") String serialize()
        {
            throw new HttpMessageNotWritableException("private-serialization-secret");
        }
    }
}
