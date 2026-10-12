package com.agri.common.result;

import com.agri.common.constant.ErrorCode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> implements Serializable {

    private int code;
    private String message;
    private T data;
    private long timestamp;

    public ApiResponse(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), "操作成功", null);
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), "操作成功", data);
    }

    public static <T> ApiResponse<T> success(String message) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), message, null);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), message, data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(ErrorCode.FAILURE.getCode(), message, null);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(ErrorCode.VALIDATION_ERROR.getCode(), message, null);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> unauthorized(String message) {
        return new ApiResponse<>(ErrorCode.UNAUTHORIZED.getCode(), message, null);
    }

    public static <T> ApiResponse<T> forbidden(String message) {
        return new ApiResponse<>(ErrorCode.FORBIDDEN.getCode(), message, null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> notFound(String message) {
        return new ApiResponse<>(ErrorCode.NOT_FOUND.getCode(), message, null);
    }

    public static <T> ApiResponse<T> validationError(String message) {
        return new ApiResponse<>(ErrorCode.VALIDATION_ERROR.getCode(), message, null);
    }

    public void setCode(ErrorCode errorCode) {
        this.code = errorCode.getCode();
        this.message = errorCode.getMessage();
    }

    public void setCode(int code) {
        this.code = code;
    }
}
