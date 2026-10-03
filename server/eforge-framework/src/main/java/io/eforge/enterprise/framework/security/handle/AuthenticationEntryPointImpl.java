package io.eforge.enterprise.framework.security.handle;

import java.io.IOException;
import java.io.Serializable;
import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import com.alibaba.fastjson2.JSON;
import io.eforge.enterprise.common.constant.HttpStatus;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.utils.ServletUtils;
import io.eforge.enterprise.common.utils.StringUtils;

/**
 * 认证失败处理类 返回未授权
 * 
 * @author ruoyi
 */
@Component
public class AuthenticationEntryPointImpl implements AuthenticationEntryPoint, Serializable
{
    private static final long serialVersionUID = -8970718410437077606L;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException
    {
        int code = HttpStatus.UNAUTHORIZED;
        if (request.getRequestURI().startsWith("/api/v1/"))
        {
            Map<String, Object> problem = new LinkedHashMap<>();
            problem.put("type", "https://eforge.dev/problems/authentication-required");
            problem.put("title", "Authentication required");
            problem.put("status", code);
            problem.put("detail", "Authentication is required to access this resource.");
            problem.put("instance", request.getRequestURI());
            problem.put("code", "AUTHENTICATION_REQUIRED");
            response.setStatus(code);
            response.setCharacterEncoding("UTF-8");
            response.setContentType("application/problem+json");
            response.getWriter().write(JSON.toJSONString(problem));
            return;
        }

        String msg = StringUtils.format("请求访问：{}，认证失败，无法访问系统资源", request.getRequestURI());
        ServletUtils.renderString(response, JSON.toJSONString(AjaxResult.error(code, msg)));
    }
}
