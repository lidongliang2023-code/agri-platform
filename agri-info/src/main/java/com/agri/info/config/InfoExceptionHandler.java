package com.agri.info.config;

import com.agri.common.result.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class InfoExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(InfoExceptionHandler.class);

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

    /**
     * 路径参数类型不匹配（例如 {@code courseId=abc}）。
     *
     * <p>不单独处理会落到下面的 Exception 兜底，返回 500「服务暂时不可用」——
     * 明明是调用方传错了参数，却报成服务端故障，排障时会被误导。</p>
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ApiResponse.fail("参数 " + exception.getName() + " 格式不正确");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnexpected(Exception exception) {
        LOG.error("Unhandled info module error", exception);
        return ApiResponse.error("信息资讯服务暂时不可用，请稍后重试");
    }
}
