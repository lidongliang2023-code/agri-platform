package com.agri.government.config;

import com.agri.common.exception.BusinessException;
import com.agri.common.result.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GovernmentExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(GovernmentExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> validation(IllegalArgumentException exception) {
        return ApiResponse.fail(exception.getMessage());
    }

    /**
     * 业务与身份异常：状态码按业务码回（400/401/403/404/409），并把真实原因带给页面。
     *
     * <p>原来所有非 IllegalArgument 的异常都会掉进下面的兜底分支，变成
     * 「政府监管服务暂时不可用」—— 身份没绑定、越权、单据不存在全被说成服务挂了，
     * 用户和值班同学都看不出该找谁。兜底只留给真正的程序异常。</p>
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> business(BusinessException exception) {
        HttpStatus status = switch (exception.getCode()) {
            case 400 -> HttpStatus.BAD_REQUEST;
            case 401 -> HttpStatus.UNAUTHORIZED;
            case 403 -> HttpStatus.FORBIDDEN;
            case 404 -> HttpStatus.NOT_FOUND;
            case 409 -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        LOG.warn("政府监管业务异常：status={} message={}", status.value(), exception.getMessage());
        return ResponseEntity.status(status).body(ApiResponse.fail(exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> unexpected(Exception exception) {
        LOG.error("Government module request failed", exception);
        return ApiResponse.error("政府监管服务暂时不可用");
    }
}
