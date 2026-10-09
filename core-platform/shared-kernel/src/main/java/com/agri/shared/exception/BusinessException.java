package com.agri.shared.exception;

import lombok.Getter;

/**
 * 业务异常：服务层抛出，由全局异常处理器统一转换为规范化错误结构，客户端绝不看到堆栈。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final int code;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCode errorCode, String detail) {
        super(detail);
        this.code = errorCode.getCode();
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}
