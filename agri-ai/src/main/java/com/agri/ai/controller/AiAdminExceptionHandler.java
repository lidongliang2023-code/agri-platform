package com.agri.ai.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=AiAdminController.class)
public class AiAdminExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("code",400,"message",
        e instanceof IllegalArgumentException ? e.getMessage() : "请求参数或JSON格式不正确")); }
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<?> status(org.springframework.web.server.ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("code",e.getStatusCode().value(),"message",e.getReason()==null?"请求失败":e.getReason()));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> failed(Exception e) { return ResponseEntity.internalServerError().body(Map.of("code",500,"message","AI管理请求处理失败，请稍后重试")); }
}
