package com.agri.s2b2c.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBusinessError(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", error.getMessage() == null ? "请求参数不合法" : error.getMessage()
        ));
    }
}
