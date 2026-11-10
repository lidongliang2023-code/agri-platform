package com.agri.finance.config;

import com.agri.common.exception.BusinessException;
import com.agri.finance.controller.WarehouseReceiptController;
import com.agri.finance.controller.WarehouseMonitorScopeController;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@Order(-1)
@RestControllerAdvice(assignableTypes={WarehouseReceiptController.class, WarehouseMonitorScopeController.class})
public class WarehouseMonitorExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String,Object>> business(BusinessException e) {
        int code=e.getCode();
        int status=java.util.Set.of(400,401,403,404,409,503).contains(code)?code:500;
        return ResponseEntity.status(status).body(Map.of("code",code,"message",e.getMessage(),"data",""));
    }
}
