package com.agri.core.infra.web;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常处理：客户端只看到规范化错误结构，绝不返回堆栈或内部细节（输出规范）。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private String traceId() {
        return MDC.get("traceId");
    }

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusiness(BusinessException e) {
        log.warn("[{}] 业务异常: code={}, msg={}", traceId(), e.getCode(), e.getMessage());
        return new ApiResponse<>(e.getCode(), e.getMessage(), null, traceId());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ApiResponse<Void> handleValidation(BindException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst()
                .orElse(ErrorCode.BAD_REQUEST.getMessage());
        return new ApiResponse<>(ErrorCode.BAD_REQUEST.getCode(), msg, null, traceId());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ApiResponse<Void> handleConstraint(ConstraintViolationException e) {
        return new ApiResponse<>(ErrorCode.BAD_REQUEST.getCode(), e.getMessage(), null, traceId());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ApiResponse<Void> handleUnreadable(Exception e) {
        return new ApiResponse<>(ErrorCode.BAD_REQUEST.getCode(), "请求体格式错误", null, traceId());
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleUnknown(Exception e) {
        log.error("[{}] 系统异常", traceId(), e);
        return new ApiResponse<>(500, "系统繁忙，请稍后重试", null, traceId());
    }
}
