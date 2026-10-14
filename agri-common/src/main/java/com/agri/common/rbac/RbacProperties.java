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
     * 平台权限解析地址。
     *
     * <p>默认取 {@code services.platform.url}（各子系统本来就要配这个域名来调 core-platform），
     * 也可以在这里单独覆盖。</p>
     */
    private String platformUrl;
}
