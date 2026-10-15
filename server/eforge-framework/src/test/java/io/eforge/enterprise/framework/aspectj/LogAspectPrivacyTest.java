package io.eforge.enterprise.framework.aspectj;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.enums.BusinessStatus;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.exception.ApiDiagnostics;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.system.domain.SysOperLog;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

class LogAspectPrivacyTest
{
    private static final String PRIVATE = "private JDBC password=credential SELECT * FROM secret_table";
    private final CapturingAspect aspect = new CapturingAspect();
    private final Fixture target = new Fixture();
    private final Logger logger = (Logger) LoggerFactory.getLogger(LogAspect.class);
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();
    private Fixture proxy;
    private MockMvc mvc;

    @BeforeEach void setup()
    {
        var factory = new AspectJProxyFactory(target); factory.addAspect(aspect); proxy = factory.getProxy();
        mvc = MockMvcBuilders.standaloneSetup(proxy).build();
        var user = new SysUser(42L); user.setUserName("audit-user");
        var department = new SysDept(); department.setDeptName("Audit Department"); user.setDept(department);
        var session = new LoginUser(user, Set.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(session, null, List.of()));
        events.start(); logger.addAppender(events);
    }

    @AfterEach void cleanup()
    {
        RequestContextHolder.resetRequestAttributes(); SecurityContextHolder.clearContext();
        logger.detachAppender(events); events.stop();
        assertNull(((ThreadLocal<?>) ReflectionTestUtils.getField(LogAspect.class, "TIME_THREADLOCAL")).get());
    }

    @Test void successfulAuditKeepsActorRequestResponseAndExistingExclusions() throws Exception
    {
        var result = mvc.perform(post("/api/v1/audit-fixture/operation").contentType("application/json")
                .content("{\"label\":\"keep normal data\",\"password\":\"must stay excluded\",\"customSecret\":\"also excluded\"}"))
                .andReturn().getResponse();
        assertEquals(200, result.getStatus()); assertEquals(1, aspect.records.size());
        var record = aspect.records.get(0); assertMetadata(record, BusinessStatus.SUCCESS);
        assertNull(record.getErrorMsg());
        assertTrue(record.getOperParam().contains("keep normal data"));
        assertFalse(record.getOperParam().contains("excluded"));
        assertTrue(record.getJsonResult().contains("result kept")); assertTrue(events.list.isEmpty());
    }

    @Test void rawAndMissingExceptionMessagesBecomeSafeSummariesSharingTheLaterHandlerId() throws Exception
    {
        for (RuntimeException failure : List.of(new IllegalStateException(PRIVATE),
                new IllegalStateException(null, new IllegalArgumentException(PRIVATE))))
        {
            target.failure = failure;
            var result = mvc.perform(post("/api/v1/audit-fixture/operation").header("X-Request-ID", "untrusted-client-id")
                    .contentType("application/json").content("{\"label\":\"failure input kept\"}"))
                    .andReturn().getResponse();
            assertEquals(500, result.getStatus());
            var record = aspect.records.get(aspect.records.size() - 1); assertMetadata(record, BusinessStatus.FAIL);
            String requestId = result.getHeader("X-Request-ID"); assertServerId(requestId);
            assertEquals(requestId, new ObjectMapper().readTree(result.getContentAsString()).path("requestId").asText());
            assertTrue(record.getErrorMsg().contains(requestId), "AfterThrowing must allocate the same ID later used by the API handler.");
            assertPrivateAbsent(record.getErrorMsg()); assertTrue(record.getErrorMsg().length() <= 2000);
            assertTrue(record.getOperParam().contains("failure input kept"));
            assertNull(record.getJsonResult());
        }
        assertTrue(events.list.isEmpty(), "Business failures belong to the existing request handler diagnostics.");
    }

    @Test void declaredSafeApiFailureKeepsPublicCodeAndDetailWithoutItsPrivateCause() throws Exception
    {
        var failure = new ApiFailure(409, "RESOURCE_CHANGED", "Reload before retrying.");
        failure.initCause(new IllegalArgumentException(PRIVATE)); target.failure = failure;
        var response = mvc.perform(post("/api/v1/audit-fixture/operation").contentType("application/json").content("{}"))
                .andReturn().getResponse();
        var record = aspect.records.get(0); assertEquals(409, response.getStatus());
        assertMetadata(record, BusinessStatus.FAIL);
        assertTrue(record.getErrorMsg().contains("RESOURCE_CHANGED")); assertTrue(record.getErrorMsg().contains("Reload before retrying."));
        assertTrue(record.getErrorMsg().contains(response.getHeader("X-Request-ID"))); assertPrivateAbsent(record.getErrorMsg());
    }

    @Test void boundedSafeAuditDetailCannotTruncateTheCorrelationId() throws Exception
    {
        target.failure = new ApiFailure(409, "RESOURCE_CHANGED", "safe ".repeat(700));
        var response = mvc.perform(post("/api/v1/audit-fixture/operation").contentType("application/json").content("{}"))
                .andReturn().getResponse();
        String text = aspect.records.get(0).getErrorMsg(); assertTrue(text.length() <= 2000);
        assertTrue(text.contains(response.getHeader("X-Request-ID"))); assertTrue(text.startsWith("RESOURCE_CHANGED"));
    }

    @Test void requestSerializationFailureNeverLogsArgumentsOrThrowableAndKeepsOtherData()
    {
        var request = bindRequest("/legacy/audit-fixture/operation");
        assertEquals("business result", proxy.arguments(new ExplodingArgument(), Map.of("label", "ordinary argument kept")));
        assertEquals(1, aspect.records.size()); var record = aspect.records.get(0);
        assertEquals(BusinessStatus.SUCCESS.ordinal(), record.getStatus());
        assertTrue(record.getOperParam().contains("ordinary argument kept"));
        assertAuditDiagnostic(request); assertPrivateAbsent(record.getOperParam());
    }

    @Test void enqueueFailureDoesNotChangeTheBusinessResultOrPrintAStackTrace() throws Exception
    {
        aspect.publishFailure = new IllegalStateException(PRIVATE);
        var previous = System.err; var captured = new ByteArrayOutputStream();
        try (var stream = new PrintStream(captured, true, StandardCharsets.UTF_8))
        {
            System.setErr(stream);
            var result = mvc.perform(post("/api/v1/audit-fixture/operation").contentType("application/json").content("{}"))
                    .andReturn();
            assertEquals(200, result.getResponse().getStatus());
            assertTrue(result.getResponse().getContentAsString().contains("result kept"));
            assertAuditDiagnostic(result.getRequest());
        }
        finally { System.setErr(previous); }
        assertEquals("", captured.toString(StandardCharsets.UTF_8));
    }

    @Test void missingRequestNeverReplacesTheOriginalBusinessFailureOrLeaksToStderr()
    {
        target.failure = new IllegalStateException(PRIVATE);
        var previous = System.err; var captured = new ByteArrayOutputStream();
        try (var stream = new PrintStream(captured, true, StandardCharsets.UTF_8))
        {
            System.setErr(stream); RequestContextHolder.resetRequestAttributes();
            assertSame(target.failure, assertThrows(IllegalStateException.class, () -> proxy.operation(Map.of())));
        }
        finally { System.setErr(previous); }
        assertEquals("", captured.toString(StandardCharsets.UTF_8)); assertTrue(aspect.records.isEmpty());
        assertEquals(1, events.list.size()); assertTrue(events.list.get(0).getFormattedMessage().contains("requestId=unavailable"));
        assertPrivateAbsent(events.list.get(0).getFormattedMessage()); assertNull(events.list.get(0).getThrowableProxy());
    }

    private static MockHttpServletRequest bindRequest(String path)
    {
        var request = new MockHttpServletRequest("POST", path); request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Request-ID", "untrusted-client-id");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request)); return request;
    }

    private static void assertMetadata(SysOperLog record, BusinessStatus status)
    {
        assertEquals(status.ordinal(), record.getStatus()); assertEquals("audit-user", record.getOperName());
        assertEquals("Audit Department", record.getDeptName()); assertEquals("Audit fixture", record.getTitle());
        assertEquals(BusinessType.UPDATE.ordinal(), record.getBusinessType()); assertEquals("POST", record.getRequestMethod());
        assertEquals("/api/v1/audit-fixture/operation", record.getOperUrl()); assertEquals("127.0.0.1", record.getOperIp());
        assertTrue(record.getMethod().endsWith("Fixture.operation()")); assertTrue(record.getCostTime() >= 0);
    }

    private void assertAuditDiagnostic(HttpServletRequest request)
    {
        assertEquals(1, events.list.size()); var event = events.list.get(0);
        String text = event.getFormattedMessage(); assertTrue(text.contains("event=audit_recording_failed"));
        assertTrue(text.contains("requestId=" + ApiDiagnostics.requestId(request)));
        assertFalse(text.contains("api_server_error")); assertPrivateAbsent(text); assertNull(event.getThrowableProxy());
    }

    private static void assertServerId(String id)
    { assertNotNull(id); assertTrue(id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}")); }

    private static void assertPrivateAbsent(String text)
    { assertFalse(text.matches("(?s).*(private|JDBC|credential|secret_table|SELECT|untrusted-client-id).*"), text); }

    static class CapturingAspect extends LogAspect
    {
        final List<SysOperLog> records = new ArrayList<>(); RuntimeException publishFailure;
        @Override protected void publish(SysOperLog record)
        { if (publishFailure != null) throw publishFailure; records.add(record); }
    }

    public static class ExplodingArgument
    {
        public String getValue() { throw new IllegalStateException(PRIVATE); }
        @Override public String toString() { return PRIVATE; }
    }

    @RestController public static class Fixture
    {
        RuntimeException failure;
        @Log(title="Audit fixture", businessType=BusinessType.UPDATE, excludeParamNames="customSecret")
        @PostMapping("/api/v1/audit-fixture/operation")
        public Map<String, String> operation(@RequestBody Map<String, Object> input)
        { if (failure != null) throw failure; return Map.of("result", "result kept"); }

        @Log(title="Audit fixture", businessType=BusinessType.UPDATE)
        public String arguments(Object broken, Map<String, String> ordinary) { return "business result"; }

        @ExceptionHandler(ApiFailure.class)
        public ResponseEntity<Object> apiFailure(ApiFailure failure, HttpServletRequest request)
        { return new ApiExceptionHandler().business(failure, request); }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<Object> unexpected(Exception failure, HttpServletRequest request)
        { return new ApiExceptionHandler().unexpected(failure, request); }
    }
}
