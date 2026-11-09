package com.agri.iot.common;

import com.agri.common.exception.BusinessException;
import com.agri.common.result.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> firmwareTooLarge(org.springframework.web.multipart.MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiResponse.fail(413,"固件文件超过上传上限，请使用不超过256MB的文件"));
    }


    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 业务异常按 code 落到对应 HTTP 状态。
     *
     * <p>物联网的身份守卫（未绑定经营主体、越权访问别的租户设备）抛的是
     * {@link BusinessException}。没有这个处理器时它会掉进下面的兜底分支，
     * 变成 500 + "服务器内部错误"：用户看不出自己是缺主体绑定还是设备不存在，
     * 前端也没法按 401 跳登录。404 是故意的 —— 越权读取别人租户的设备要报"不存在"，
     * 不能报"存在但不属于你"，否则id 空间就成了可枚举的。</p>
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        HttpStatus status = switch (ex.getCode()) {
            case 401 -> HttpStatus.UNAUTHORIZED;
            case 403 -> HttpStatus.FORBIDDEN;
            case 404 -> HttpStatus.NOT_FOUND;
            case 409 -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        logger.warn("物联网业务异常：status={} message={}", status.value(), ex.getMessage());
        return ResponseEntity.status(status).body(ApiResponse.fail(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseResult<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return ResponseResult.error(400, "参数校验失败");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseResult<String> handleIllegalArgumentException(IllegalArgumentException ex) {
        logger.warn("Illegal argument: {}", ex.getMessage());
        return ResponseResult.error(400, ex.getMessage());
    }

    /**
     * 跨域调用与框架层异常按各自的 HTTP 状态返回。
     *
     * <p>兜底分支会把它们全吞成 500 +"服务器内部错误"：农场校验调不通生产端（本应 502，
     * 提示"生产管理暂时不可用"）、请求方法不对（405）、路径写错（404）、请求体不是 JSON（400）
     * 在页面上都变成同一句话，前端只能反复重试，排查也没有方向。</p>
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        logger.warn("物联网请求异常：status={} reason={}", ex.getStatusCode().value(), ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(
                ApiResponse.fail(ex.getStatusCode().value(),
                        ex.getReason() == null ? "请求处理失败，请稍后重试" : ex.getReason()));
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnsupportedMediaType(org.springframework.web.HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiResponse.fail(415, "请求格式不支持；文件上传请使用 multipart/form-data，并通过 file 字段选择文件"));
    }

    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingUploadPart(org.springframework.web.multipart.support.MissingServletRequestPartException ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, "缺少上传文件字段，请通过 file 字段选择文件后重试"));
    }

    @ExceptionHandler(org.springframework.web.multipart.MultipartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMalformedUpload(org.springframework.web.multipart.MultipartException ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(400, "上传内容格式不正确或不完整，请重新选择文件后上传"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.fail(405, "接口不支持 " + ex.getMethod() + " 方法"));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception ex) {
        logger.warn("物联网请求参数异常：{}", ex.getMessage());
        return ResponseEntity.badRequest().body(ApiResponse.fail(400, "请求参数格式不正确，请检查后重试"));
    }

    /**
     * 路径没注册 → 404。
     *
     * <p>这一条是为本轮下线的 {@code POST /alert-rules/{id}/toggle} 兜底：接口不存在时
     * Spring 抛的是 NoResourceFoundException，过去会掉进兜底分支变成 500 +"服务器内部错误"，
     * 前端和排查的人都会以为服务坏了，而事实只是"这个接口没有了"。</p>
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiResponse<Void>> handleNotFound(Exception ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.fail(404, "接口不存在或已下线，请刷新页面或联系平台运营"));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseResult<String> handleGenericException(Exception ex) {
        logger.error("Unexpected error occurred", ex);
        return ResponseResult.error("服务器内部错误");
    }
}
