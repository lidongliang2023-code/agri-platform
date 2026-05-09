package com.agri.common.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    SUCCESS(200, "操作成功"),

    PARAM_NOT_NULL(1001, "参数不能为空"),
    PARAM_TYPE_ERROR(1002, "参数类型错误"),
    PARAM_FORMAT_ERROR(1003, "参数格式错误"),
    PARAM_VALIDATE_ERROR(1004, "参数校验失败"),

    USER_NOT_FOUND(2001, "用户不存在"),
    USER_PASSWORD_ERROR(2002, "密码错误"),
    USER_DISABLED(2003, "用户已被禁用"),
    USER_TOKEN_EXPIRED(2004, "Token已过期"),
    USER_TOKEN_INVALID(2005, "Token无效"),
    USER_NOT_LOGIN(2006, "用户未登录"),
    USER_LOGIN_FAILED(2007, "登录失败"),
    USER_CAPTCHA_ERROR(2008, "验证码错误"),
    USER_CAPTCHA_EXPIRED(2009, "验证码已过期"),
    USER_OLD_PASSWORD_ERROR(2010, "原密码错误"),
    USER_PASSWORD_SAME(2011, "新密码不能与原密码相同"),

    PERMISSION_DENIED(3001, "没有访问权限"),
    PERMISSION_FORBIDDEN(3002, "禁止访问该资源"),
    ROLE_NOT_FOUND(3003, "角色不存在"),
    ROLE_HAS_USER(3004, "该角色下存在用户，无法删除"),

    ORG_NOT_FOUND(4001, "组织不存在"),
    ORG_HAS_CHILDREN(4002, "该组织下存在子组织，无法删除"),
    ORG_HAS_USER(4003, "该组织下存在用户，无法删除"),

    DATA_NOT_FOUND(5001, "数据不存在"),
    DATA_DUPLICATE(5002, "数据重复"),
    DATA_HAS_RELATED(5003, "数据存在关联，无法操作"),
    OPERATION_FAILED(5004, "操作失败"),

    SYSTEM_ERROR(9001, "系统异常"),
    SYSTEM_BUSY(9002, "系统繁忙，请稍后再试"),
    SYSTEM_MAINTENANCE(9003, "系统维护中"),
    SERVICE_UNAVAILABLE(9004, "服务暂不可用");

    private final int code;
    private final String message;

    public String getMessage() {
        return message;
    }
}