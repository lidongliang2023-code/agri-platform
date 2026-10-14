package com.agri.production.common.entity;

import lombok.Data;

import java.io.Serializable;

/**
 * 统一响应包装体。
 *
 * <p><b>成功码是 0，不是 200</b>。平台口径（core-platform 的 shared-kernel
 * {@code ApiResponse}、前端 {@code utils/request.ts} 的 {@code SUCCESS_CODE}）都是
 * {@code code === 0} 才算成功；本服务原先返回 200，于是前端拦截器把**每一个成功响应**
 * 都当成业务失败 reject 掉 —— 页面表现为"接口 HTTP 200、但什么都加载不出来"，
 * 而 curl 直接看却一切正常。这类不一致只有把前端接上来才看得见，必须一次对齐。</p>
 *
 * <p>HTTP 状态码仍然由各控制器/异常处理器决定（如鉴权失败的 401/403），
 * 这里的 {@code code} 只表达业务结果。</p>
 */
@Data
public class ApiResponse<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 业务成功码（与平台一致） */
    public static final int SUCCESS_CODE = 0;

    private Integer code;
    private String message;
    private T data;

    public ApiResponse() {
    }

    public ApiResponse(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(SUCCESS_CODE, "success", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(SUCCESS_CODE, message, data);
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(SUCCESS_CODE, "success", null);
    }

    public static <T> ApiResponse<T> error(Integer code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(500, message, null);
    }

    public static <T> ApiResponse<T> fail(Integer code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
