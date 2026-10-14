package com.agri.common.rbac;

import java.util.Set;

/**
 * 解析"当前调用方"的权限码。
 *
 * <p>抽成接口是为了两件事：子系统可以换成自己的实现（例如本地缓存或网关透传），
 * 以及单测里可以替换成桩而不必真起一个 core-platform。</p>
 */
public interface PermissionResolver {

    /**
     * 当前请求的权限码；**解析失败返回 null**（调用方据此 fail closed：
     * 宁可拒绝，也不退化成"没有权限就是通过"）。
     *
     * @return 权限码集合，或 null 表示无法解析
     */
    Set<String> currentPermissions();
}
