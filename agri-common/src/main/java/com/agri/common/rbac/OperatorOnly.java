package com.agri.common.rbac;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记"只有平台运营能调"的接口，由 {@link OperatorGuardInterceptor} 强制。
 *
 * <p>为什么除了路径前缀还要这个注解：运营端的写接口并不都在
 * {@code .../admin/**} 下 —— "审核某张订单的退款"、"给某场纠纷做仲裁"这类
 * 天然属于业务资源的运营动作，挂在业务路径上。只按前缀拦会漏掉最要命的口子。</p>
 *
 * <p>取值是权限码，与平台 {@code platform_role.permissions} 同一套词表；
 * 留空则用 {@code platform.rbac.write-permission} 配置的默认写权限。</p>
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface OperatorOnly {

    /** 需要的权限码；留空表示用 {@code platform.rbac.write-permission}。 */
    String value() default "";
}
