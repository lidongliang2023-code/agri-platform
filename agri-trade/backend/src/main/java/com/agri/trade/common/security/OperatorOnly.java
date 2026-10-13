package com.agri.trade.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记"只有平台运营能调"的接口，由 {@link OperatorGuardInterceptor} 强制。
 *
 * <p>为什么需要它：运营端的写接口并不都在 {@code /api/trade/admin/**} 下 ——
 * 退款审核、纠纷调解/仲裁、赔付审核/打款这些挂在业务路径上（因为它们天然属于
 * "某张订单/某场纠纷"的资源）。只按路径前缀拦会漏掉这些最要命的口子
 * （打款、退款都是真金白银），所以再给一个显式标注。</p>
 *
 * <p>取值是权限码，与 {@code platform_role.permissions} 同一套词表
 * （{@code trade:read} / {@code trade:write} / {@code *}）。</p>
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface OperatorOnly {

    /** 需要的权限码，默认运营写权限。 */
    String value() default "trade:write";
}
