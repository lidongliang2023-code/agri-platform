package com.agri.common.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    SUCCESS(200, "操作成功"),
    FAILURE(500, "系统异常"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "禁止访问"),
    NOT_FOUND(404, "数据不存在"),
    VALIDATION_ERROR(400, "参数校验失败"),

    PARAM_NOT_NULL(1001, "参数不能为空"),
    PARAM_TYPE_ERROR(1002, "参数类型错误"),
    PARAM_FORMAT_ERROR(1003, "参数格式错误"),
    PARAM_VALIDATE_ERROR(1004, "参数校验失败"),

    USER_NOT_FOUND(2001, "用户不存在"),
    USER_EXISTS(2002, "用户已存在"),
    USER_PASSWORD_ERROR(2003, "密码错误"),
    USER_DISABLED(2004, "用户已被禁用"),
    USER_TOKEN_EXPIRED(2005, "Token已过期"),
    USER_TOKEN_INVALID(2006, "Token无效"),
    USER_NOT_LOGIN(2007, "用户未登录"),
    USER_LOGIN_FAILED(2008, "登录失败"),
    USER_CAPTCHA_ERROR(2009, "验证码错误"),
    USER_CAPTCHA_EXPIRED(2010, "验证码已过期"),
    USER_OLD_PASSWORD_ERROR(2011, "原密码错误"),
    USER_PASSWORD_SAME(2012, "新密码不能与原密码相同"),
    PASSWORD_ERROR(2013, "密码错误"),
    TOKEN_INVALID(2014, "Token无效"),
    TOKEN_EXPIRED(2015, "Token已过期"),
    TOKEN_NOT_FOUND(2016, "Token不存在"),

    PERMISSION_DENIED(3001, "没有访问权限"),
    PERMISSION_FORBIDDEN(3002, "禁止访问该资源"),
    ROLE_NOT_FOUND(3003, "角色不存在"),
    ROLE_HAS_USER(3004, "该角色下存在用户，无法删除"),

    TENANT_NOT_FOUND(4001, "租户不存在"),
    TENANT_EXISTS(4002, "租户已存在"),
    TENANT_DISABLED(4003, "租户已被禁用"),

    ORG_NOT_FOUND(5001, "组织不存在"),
    ORG_HAS_CHILDREN(5002, "该组织下存在子组织，无法删除"),
    ORG_HAS_USER(5003, "该组织下存在用户，无法删除"),

    FARM_NOT_FOUND(6001, "农场不存在"),
    FARM_EXISTS(6002, "农场已存在"),

    DEVICE_NOT_FOUND(7001, "设备不存在"),
    DEVICE_OFFLINE(7002, "设备离线"),

    DATA_NOT_FOUND(8001, "数据不存在"),
    DATA_DUPLICATE(8002, "数据重复"),
    DATA_HAS_RELATED(8003, "数据存在关联，无法操作"),
    OPERATION_FAILED(8004, "操作失败"),

    SYSTEM_ERROR(9001, "系统异常"),
    SYSTEM_BUSY(9002, "系统繁忙，请稍后再试"),
    SYSTEM_MAINTENANCE(9003, "系统维护中"),
    SERVICE_UNAVAILABLE(9004, "服务暂不可用");

    private final int code;
    private final String message;

    public static int valueOfCode(int code) {
        for (ErrorCode errorCode : values()) {
            if (errorCode.getCode() == code) {
                return errorCode.getCode();
            }
        }
        return FAILURE.getCode();
    }
}
