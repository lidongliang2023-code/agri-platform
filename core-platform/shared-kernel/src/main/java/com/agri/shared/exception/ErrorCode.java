package com.agri.shared.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 全局错误码。0 表示成功；4xx 透传 HTTP 语义；1xxx 通用业务；2xxx 交易域；3xxx 生产域；4xxx 服务域；5xxx 平台域。
 */
@Getter
@AllArgsConstructor
public enum ErrorCode {

    OK(0, "成功"),

    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未认证或凭证已失效"),
    FORBIDDEN(403, "无权访问"),
    NOT_FOUND(404, "资源不存在"),
    METHOD_NOT_ALLOWED(405, "请求方式不支持"),
    CONFLICT(409, "资源冲突"),

    BIZ_ERROR(1000, "业务处理失败"),
    DUPLICATE_KEY(1001, "数据重复"),
    OPTIMISTIC_LOCK(1002, "数据已被修改，请刷新后重试"),

    LISTING_CLOSED(2001, "挂牌已关闭或已成交"),
    ORDER_NOT_PAYABLE(2002, "订单当前状态不可支付"),
    ORDER_NOT_FOUND(2003, "订单不存在"),
    SETTLE_FAILED(2004, "结算失败"),

    BATCH_NOT_HARVESTABLE(3001, "批次当前状态不可采收"),
    TRACE_CODE_DUPLICATED(3002, "溯源码已生成"),

    QUOTE_PUBLISH_FAILED(4001, "行情发布失败"),

    USER_OR_PASSWORD_ERROR(5001, "用户名或密码错误"),
    USER_DISABLED(5002, "用户已被禁用"),
    REFRESH_TOKEN_INVALID(5003, "刷新凭证无效或已过期");

    private final int code;
    private final String message;
}
