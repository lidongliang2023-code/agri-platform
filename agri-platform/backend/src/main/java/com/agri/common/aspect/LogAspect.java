package com.agri.common.aspect;

import com.agri.common.annotation.LogOperation;
import com.agri.common.security.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Arrays;

@Slf4j
@Aspect
@Component
public class LogAspect {

    @Pointcut("@annotation(com.agri.common.annotation.LogOperation)")
    public void logPointcut() {
    }

    @Around("logPointcut()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = null;
        Throwable exception = null;

        try {
            result = joinPoint.proceed();
            return result;
        } catch (Throwable e) {
            exception = e;
            throw e;
        } finally {
            long endTime = System.currentTimeMillis();
            saveLog(joinPoint, startTime, endTime, result, exception);
        }
    }

    private void saveLog(ProceedingJoinPoint joinPoint, long startTime, long endTime,
                         Object result, Throwable exception) {
        try {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            Method method = signature.getMethod();
            LogOperation logAnnotation = method.getAnnotation(LogOperation.class);

            if (logAnnotation == null) {
                return;
            }

            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            HttpServletRequest request = attributes != null ? attributes.getRequest() : null;

            String className = joinPoint.getTarget().getClass().getSimpleName();
            String methodName = method.getName();
            String operationType = logAnnotation.type().name();
            String module = logAnnotation.module();
            String content = logAnnotation.content();

            String username = SecurityUtils.getUsername();
            String ip = request != null ? getClientIp(request) : "unknown";
            String url = request != null ? request.getRequestURI() : "unknown";
            String httpMethod = request != null ? request.getMethod() : "unknown";
            String params = getParams(joinPoint);

            if (exception != null) {
                log.error("Operation Log - Module: {}, Content: {}, User: {}, IP: {}, URL: {}, Method: {}, Time: {}ms, Error: {}",
                        module, content, username, ip, url, httpMethod + ":" + className + "." + methodName,
                        (endTime - startTime), exception.getMessage());
            } else {
                log.info("Operation Log - Module: {}, Content: {}, User: {}, IP: {}, URL: {}, Method: {}, Time: {}ms",
                        module, content, username, ip, url, httpMethod + ":" + className + "." + methodName,
                        (endTime - startTime));
            }
        } catch (Exception e) {
            log.error("Failed to save operation log", e);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    private String getParams(ProceedingJoinPoint joinPoint) {
        try {
            Object[] args = joinPoint.getArgs();
            if (args == null || args.length == 0) {
                return "";
            }
            return Arrays.toString(args);
        } catch (Exception e) {
            return "";
        }
    }
}
