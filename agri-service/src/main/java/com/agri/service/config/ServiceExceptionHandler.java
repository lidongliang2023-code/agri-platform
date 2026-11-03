package com.agri.service.config;

import com.agri.common.exception.BusinessException;
import com.agri.common.result.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class ServiceExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(ServiceExceptionHandler.class);

    /**
     * 业务异常按 code 落到对应的 HTTP 状态。
     *
     * <p>原先所有非 {@code IllegalArgumentException} 的异常都会掉进下面的兜底分支，
     * 变成 HTTP 500 + "服务暂时不可用，请稍后重试"：身份没绑定（本该 403 并说明该找谁）、
     * 单据不归属当前主体（本该 403）、状态机冲突（本该 409）全都糊成一句"服务不可用"，
     * 页面只能重试，用户永远不知道自己缺哪一步。</p>
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException exception) {
        HttpStatus status = switch (exception.getCode()) {
            case 401 -> HttpStatus.UNAUTHORIZED;
            case 403 -> HttpStatus.FORBIDDEN;
            case 404 -> HttpStatus.NOT_FOUND;
            case 409 -> HttpStatus.CONFLICT;
            case 400 -> HttpStatus.BAD_REQUEST;
            default -> HttpStatus.BAD_REQUEST;
        };
        LOG.warn("综合服务业务异常：status={} message={}", status.value(), exception.getMessage());
        return ResponseEntity.status(status)
                .body(ApiResponse.fail(exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidation(IllegalArgumentException exception) {
        return ApiResponse.fail(exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBinding(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage() == null ? "表单校验失败" : error.getDefaultMessage())
                .orElse("表单校验失败");
        return ApiResponse.fail(message);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnexpected(Exception exception) {
        LOG.error("Unhandled service module error", exception);
        return ApiResponse.error("服务暂时不可用，请稍后重试");
    }
}
