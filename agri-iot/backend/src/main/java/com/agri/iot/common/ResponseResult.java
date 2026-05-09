package com.agri.iot.common;

import java.util.HashMap;
import java.util.Map;

public class ResponseResult<T> {

    private Integer code;
    private String message;
    private T data;
    private Map<String, Object> extra;

    public ResponseResult() {
    }

    public ResponseResult(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ResponseResult<T> success(T data) {
        return new ResponseResult<>(200, "success", data);
    }

    public static <T> ResponseResult<T> success(String message, T data) {
        return new ResponseResult<>(200, message, data);
    }

    public static <T> ResponseResult<T> success() {
        return new ResponseResult<>(200, "success", null);
    }

    public static <T> ResponseResult<T> error(String message) {
        return new ResponseResult<>(500, message, null);
    }

    public static <T> ResponseResult<T> error(Integer code, String message) {
        return new ResponseResult<>(code, message, null);
    }

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public Map<String, Object> getExtra() {
        return extra;
    }

    public void setExtra(Map<String, Object> extra) {
        this.extra = extra;
    }

    public ResponseResult<T> addExtra(String key, Object value) {
        if (this.extra == null) {
            this.extra = new HashMap<>();
        }
        this.extra.put(key, value);
        return this;
    }
}