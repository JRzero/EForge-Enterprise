package io.eforge.enterprise.framework.web.exception;

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import io.eforge.enterprise.common.exception.ApiFailure;
import org.slf4j.Logger;

/** Error-only correlation and bounded diagnostics. Never serializes a Throwable or request data. */
public final class ApiDiagnostics
{
    public static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String REQUEST_ID_ATTRIBUTE = ApiDiagnostics.class.getName() + ".requestId";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_CAUSES = 4;
    private static final int MAX_FRAMES = 8;
    private static final int MAX_INSPECTED_FRAMES = 64;

    private ApiDiagnostics() { }

    public static String requestId(HttpServletRequest request)
    {
        // An inbound header/query parameter can never select a diagnostic identity.
        synchronized (request)
        {
            Object existing = request.getAttribute(REQUEST_ID_ATTRIBUTE);
            if (existing instanceof UUID id) return id.toString();
            UUID id = UUID.randomUUID();
            request.setAttribute(REQUEST_ID_ATTRIBUTE, id);
            return id.toString();
        }
    }

    public static void reportServerError(Logger logger, Exception exception, int status, HttpServletRequest request)
    {
        if (status < 500) return;
        String record = serverError(exception, status, request);
        // Unavailability includes intentionally disabled capabilities; keep it out of ERROR alerts.
        if (status == 503) logger.warn("{}", record);
        else logger.error("{}", record);
    }

    private static String serverError(Exception exception, int status, HttpServletRequest request)
    {
        List<Map<String, Object>> errors = new ArrayList<>();
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable cause = exception;
        while (cause != null && errors.size() < MAX_CAUSES && seen.add(cause))
        {
            List<String> locations = new ArrayList<>();
            StackTraceElement[] frames = cause.getStackTrace();
            for (int index = 0; index < Math.min(frames.length, MAX_INSPECTED_FRAMES); index++)
            {
                StackTraceElement frame = frames[index];
                // File names and library/generated frames are excluded, as are exception messages.
                if (frame.getClassName().startsWith("io.eforge.enterprise.")
                        && isSymbol(frame.getClassName()) && isSymbol(frame.getMethodName()))
                {
                    locations.add(frame.getClassName() + "." + frame.getMethodName() + ":" + frame.getLineNumber());
                    if (locations.size() == MAX_FRAMES) break;
                }
            }
            String type = cause.getClass().getName();
            errors.add(Map.of("type", isSymbol(type) ? type : "unavailable", "locations", locations));
            cause = cause.getCause();
        }
        try
        {
            String code = exception instanceof ApiFailure failure && failure.code() != null
                    && failure.code().matches("[A-Z0-9_]{1,80}") ? failure.code() : "HTTP_" + status;
            String path = request.getRequestURI().substring(request.getContextPath().length());
            String entryPoint = path.equals("/api/v1") || path.startsWith("/api/v1/") ? "canonical_http" : "compatibility_http";
            return JSON.writeValueAsString(Map.of("event", "api_server_error", "entryPoint", entryPoint,
                    "status", status, "code", code, "requestId", requestId(request), "errors", errors));
        }
        catch (JsonProcessingException failure)
        {
            // Only fixed keys, numbers and strings are serialized. Keep even this fallback private.
            return "{\"event\":\"api_diagnostic_serialization_failed\",\"requestId\":\"" + requestId(request) + "\"}";
        }
    }

    private static boolean isSymbol(String value)
    {
        return value.length() <= 200 && value.matches("[a-zA-Z0-9_.$<>]+");
    }
}
