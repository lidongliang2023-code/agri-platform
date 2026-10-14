package com.agri.common.rbac;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * 运营端准入的配置项（各子系统按自己的路径与权限码填）。
 *
 * <p>示例（主数据模块）：
 * <pre>
 * platform:
 *   rbac:
 *     operator-paths:
 *       - /admin/masterdata/**
 *     read-permission: masterdata:read
 *     write-permission: masterdata:write
 * </pre></p>
 */
@Data
@ConfigurationProperties(prefix = "platform.rbac")
public class RbacProperties {

    /** 是否启用（默认启用；单测或本地调试可关）。 */
    private boolean enabled = true;

    /**
     * 运营端路径前缀（Ant 风格）。命中即要求 {@link #readPermission}。
     *
     * <p>刻意**不给默认值**：默认成 {@code /**} 会把用户端接口一起拦掉，
     * 默认成空则等于没配 —— 两种情况都会以"看起来启用了、其实没生效"收场，
     * 所以要求各子系统显式写出自己的运营路径。</p>
     */
    private List<String> operatorPaths = new ArrayList<>();

    /** 运营端读权限码。 */
    private String readPermission = "platform:read";

    /** 运营端写权限码（{@code @OperatorOnly} 不带值时用它）。 */
    private String writePermission = "platform:write";

    /**
     * 命中运营路径时**是否必须带令牌**。
     *
     * <p>默认 false：多数子系统自己那层已经有认证（网关注入身份、或本服务的过滤器校验令牌），
     * 拦截器只做授权，没令牌就交给那层去回 401，避免出现"没登录被告知无权限"的误导。</p>
     *
     * <p>但对**完全没有认证层**的服务（例如 IoT 后端：只有 CORS 与密码编码器，没有任何
     * 令牌校验），默认行为等于运营接口裸奔 —— 此时把它设为 true：运营路径没令牌直接 401。</p>
     */
    private boolean requireAuth = false;

    /**
     * 平台权限解析地址。
     *
     * <p>默认取 {@code services.platform.url}（各子系统本来就要配这个域名来调 core-platform），
     * 也可以在这里单独覆盖。</p>
     */
    private String platformUrl;
}
