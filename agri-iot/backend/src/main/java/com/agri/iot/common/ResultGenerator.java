package com.agri.iot.common;

public class ResultGenerator {

    public static <T> ResponseResult<T> genSuccessResult() {
        return ResponseResult.success();
    }

    public static <T> ResponseResult<T> genSuccessResult(T data) {
        return ResponseResult.success(data);
    }

    public static <T> ResponseResult<T> genSuccessResult(String message, T data) {
        return ResponseResult.success(message, data);
    }

    public static <T> ResponseResult<T> genFailResult(String message) {
        return ResponseResult.error(message);
    }

    public static <T> ResponseResult<T> genFailResult(Integer code, String message) {
        return ResponseResult.error(code, message);
    }
}