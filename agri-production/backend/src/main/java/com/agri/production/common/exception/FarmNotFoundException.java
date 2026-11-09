package com.agri.production.common.exception;

/** 不区分资源不存在与跨租户访问，避免泄露其他主体的农场信息。 */
public class FarmNotFoundException extends BusinessException {

    public FarmNotFoundException() {
        super(404, "农场不存在");
    }
}
