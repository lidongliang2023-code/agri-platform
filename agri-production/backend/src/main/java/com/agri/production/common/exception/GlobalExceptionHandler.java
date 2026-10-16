package com.agri.production.common.exception;

import com.agri.production.common.entity.ApiResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusinessException(BusinessException e) {
        log.error("业务异常: {}", e.getMessage());
        return ApiResponse.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ApiResponse<Void> handleValidException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.error("参数校验异常: {}", message);
        return ApiResponse.fail(400, message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ApiResponse<Void> handleConstraintViolationException(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining(", "));
        log.error("约束校验异常: {}", message);
        return ApiResponse.fail(400, message);
    }

    @ExceptionHandler(BindException.class)
    public ApiResponse<Void> handleBindException(BindException e) {
        String message = e.getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.error("绑定异常: {}", message);
        return ApiResponse.fail(400, message);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMissingServletRequestParameterException(
            MissingServletRequestParameterException e) {
        log.error("缺少请求参数: {}", e.getMessage());
        return ApiResponse.fail(400, "缺少请求参数: " + e.getParameterName());
    }

    /**
     * 请求体解析不了（JSON 语法错、类型对不上）→ **400**，而不是 500。
     *
     * <p>实测（2026-10-16）：body 里多一个反斜杠，本服务回的是
     * {@code {"code":500,"message":"系统异常，请稍后再试"}} —— 调用方看到的是"服务挂了"，
     * 实际只是自己 JSON 写错了；而平台侧同样的情况回 400「请求体格式错误」。
     * 这条缺失让**每一个写接口**都把"参数写错"报成"系统故障"，排查方向直接被带偏。</p>
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleHttpMessageNotReadableException(HttpMessageNotReadableException e) {
        log.warn("请求体格式错误: {}", e.getMessage());
        return ApiResponse.fail(400, "请求体格式错误");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMethodArgumentTypeMismatchException(
            MethodArgumentTypeMismatchException e) {
        log.error("参数类型不匹配: {}", e.getMessage());
        return ApiResponse.fail(400, "参数类型不匹配: " + e.getName());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ApiResponse<Void> handleHttpRequestMethodNotSupportedException(
            HttpRequestMethodNotSupportedException e) {
        log.error("请求方法不支持: {}", e.getMessage());
        return ApiResponse.fail(405, "不支持的请求方法: " + e.getMethod());
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNoHandlerFoundException(NoHandlerFoundException e) {
        log.error("资源不存在: {}", e.getMessage());
        return ApiResponse.fail(404, "资源不存在");
    }

    /**
     * 路径不存在 → 404。
     *
     * <p>Spring Boot 3.2 起，未匹配的请求会落到静态资源处理器并抛
     * {@link NoResourceFoundException}（而不是上面那个 NoHandlerFoundException）——
     * 上面那条规则因此从来不会命中，未匹配路径会被下面的 Exception 兜底成 **500**，
     * 实测拼错一个接口地址就是 {"code":500,"message":"系统异常，请稍后再试"}，
     * 前端会以为服务挂了、日志里也是 ERROR 级别（其实只是地址写错）。</p>
     */
    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNoResourceFoundException(NoResourceFoundException e) {
        log.warn("接口不存在: {}", e.getResourcePath());
        return ApiResponse.fail(404, "接口不存在：" + e.getResourcePath());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return ApiResponse.error("系统异常，请稍后再试");
    }
}
