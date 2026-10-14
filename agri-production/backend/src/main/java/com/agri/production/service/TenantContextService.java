package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;

/**
 * 租户上下文：**一主体一租户**。
 *
 * <p>这个模块原先所有用户侧入口都写死 {@code String tenantId = "T001";}，
 * 等于多租户是形式上的单租户（详见下面的说明）。按拍板口径，租户 = 调用方绑定的
 * **经营主体**（不需要市场维度），这里负责把"当前调用方是谁的主体"解析出来。</p>
 *
 * <p>解析方式与交易模块同一套：转发平台访问令牌调 core-platform 的
 * {@code /api/v1/platform/merchants/mine}（身份从令牌来，不接受"查谁"的参数），
 * 取绑定主体。按请求缓存，一次请求只回源一次。</p>
 *
 * <p><b>为什么做成静态访问</b>：租户是"环境量"，每个控制器、每个 service 都要用；
 * 逐个改构造器注入会横跨十几个文件且容易漏。平台侧自己的 {@code MarketContext}
 * 也是这么做的（静态上下文 + RequestContextHolder），这里保持一致。</p>
 *
 * <p><b>解析不到一律报错，绝不退化成"看全部"</b>：没令牌、没绑主体、平台不可达
 * 都直接失败并给出可操作的原因 —— 静默返回空集合会让人以为"这家没数据"。</p>
 */
@Slf4j
@Service
public class TenantContextService {

    private static final String REQUEST_ATTR = TenantContextService.class.getName() + ".tenant";
    private static final String AUTHORIZATION = "Authorization";
    /** 绑定了多家主体时，用它显式指定本次操作以哪家身份进行。 */
    private static final String MERCHANT_HEADER = "X-Merchant-Id";

    private static volatile TenantContextService instance;

    private final RestTemplate restTemplate = new RestTemplate();
    private final String platformUrl;

    public TenantContextService(@Value("${services.platform.url:}") String platformUrl) {
        this.platformUrl = platformUrl;
        instance = this;
        log.info("租户上下文已装配：tenant = 调用方绑定的经营主体（平台地址 {}）",
                platformUrl == null || platformUrl.isBlank() ? "未配置" : platformUrl);
    }

    /**
     * 当前调用方的租户（= 经营主体 id 的字符串形式）。
     *
     * @throws BusinessException 未登录 / 未绑定主体 / 绑定了多家未指定 / 平台不可达
     */
    public static String currentTenantId() {
        if (instance == null) {
            throw new BusinessException(500, "租户上下文未初始化（TenantContextService 未被装配）");
        }
        return instance.resolve();
    }

    private String resolve() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            throw new BusinessException(500, "当前没有请求上下文，无法解析租户");
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof String tenant) {
            return tenant;
        }

        String token = bearerToken(request);
        if (token == null) {
            // 这个模块没有自己的认证层，租户解析这一层同时承担"必须登录"的判定
            throw new BusinessException(401, "未登录：缺少平台访问令牌");
        }
        if (platformUrl == null || platformUrl.isBlank()) {
            throw new BusinessException(500, "未配置平台地址（services.platform.url），无法解析租户");
        }

        List<Map<String, Object>> bindings;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            ResponseEntity<Map> response = restTemplate.exchange(
                    platformUrl + "/api/v1/platform/merchants/mine",
                    HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            bindings = readBindings(response.getBody());
        } catch (Exception e) {
            log.warn("解析经营主体失败：{}", e.getMessage());
            throw new BusinessException(500, "无法解析你的经营主体（平台认证中心不可达），请稍后重试");
        }

        if (bindings == null || bindings.isEmpty()) {
            throw new BusinessException(403, "当前账号还没有绑定经营主体，请联系平台运营在「用户-主体绑定」里配置");
        }

        String tenantId = pickTenant(bindings, request);
        request.setAttribute(REQUEST_ATTR, tenantId);
        return tenantId;
    }

    /**
     * 选定本次操作的租户。
     *
     * <p>绑了一家就用它；绑了多家必须用 {@code X-Merchant-Id} 显式指定 ——
     * 替调用方"随便挑一家"会让数据落到不该落的主体上，宁可报错。</p>
     */
    private String pickTenant(List<Map<String, Object>> bindings, HttpServletRequest request) {
        List<String> ids = bindings.stream()
                .map(b -> b.get("merchantId"))
                .filter(java.util.Objects::nonNull)
                .map(String::valueOf)
                .toList();
        if (ids.isEmpty()) {
            throw new BusinessException(403, "当前账号绑定的经营主体数据异常（缺少 merchantId），请联系平台运营核查");
        }
        if (ids.size() == 1) {
            return ids.get(0);
        }
        String requested = request.getHeader(MERCHANT_HEADER);
        if (requested != null && !requested.isBlank()) {
            if (!ids.contains(requested.trim())) {
                throw new BusinessException(403, "你无权以该经营主体发起操作：" + requested.trim());
            }
            return requested.trim();
        }
        throw new BusinessException(400,
                "当前账号绑定了多家经营主体，请在请求头 " + MERCHANT_HEADER + " 指定本次操作的主体：" + ids);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readBindings(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object data = body.get("data");
        if (data instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        // 平台返回 error 结构（未认证等）时按"解析不到绑定"处理，由上层给明确提示
        return null;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }
}
