package com.agri.trade.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.Map;

/**
 * 平台身份接口（core-platform）。
 *
 * <p>只有一个方法：拿**调用方自己的**经营主体。刻意没有"传 userId 查别人的主体"这种形参 ——
 * 平台侧也就只开了 {@code /api/v1/platform/merchants/mine} 这一个解析入口
 * （见 core-platform 的 UserMerchantController），两侧一起把越权面关上。</p>
 *
 * <p>令牌必须**转发**过去（Authorization 原样透传）：平台侧是拿令牌里的 sub 反查绑定的，
 * 不转发就等于以匿名身份查询。</p>
 */
@FeignClient(name = "platform", url = "${services.platform.url}")
public interface PlatformFeignClient {

    @GetMapping("/api/v1/platform/merchants/mine")
    Map<String, Object> myMerchants(@RequestHeader("Authorization") String authorization);

    /**
     * 调用方在当前市场下的角色与权限码（RBAC 实时鉴权）。
     *
     * <p>与上面同一口径：只解析"自己"，不接受 userId 参数 —— 否则换个 id
     * 就能探测别人的权限。运营端接口的准入判定走这里（见 OperatorPermissionService）。</p>
     */
    @GetMapping("/api/v1/platform/permissions/mine")
    Map<String, Object> myPermissions(@RequestHeader("Authorization") String authorization);
}
