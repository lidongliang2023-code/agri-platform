package com.agri.common.entity;

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

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(200, "操作成功", null);
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "操作成功", data);
    }

    public static <T> ApiResponse<T> success(String message) {
        return new ApiResponse<>(200, message, null);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(200, message, data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(500, message, null);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(400, message, null);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> unauthorized(String message) {
        return new ApiResponse<>(401, message, null);
    }

    public static <T> ApiResponse<T> forbidden(String message) {
        return new ApiResponse<>(403, message, null);
    }

    public static <T> ApiResponse<T> created() {
        return new ApiResponse<>(201, "创建成功", null);
    }

    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(201, "创建成功", data);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchResult {
        private Integer successCount;
        private Integer failCount;
        private String failMessage;
    }
}
