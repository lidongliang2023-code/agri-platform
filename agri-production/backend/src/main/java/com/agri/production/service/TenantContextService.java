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

    /** 解析结果的短 TTL 缓存：key = 访问令牌，value = 该令牌的主体绑定列表。 */
    private static final long CACHE_TTL_MILLIS = 60_000L;
    /** 缓存条目上限（防令牌无限增长把内存吃满；超了直接清空，最坏退化成"不缓存"）。 */
    private static final int CACHE_MAX_ENTRIES = 500;
    private final java.util.Map<String, CachedBindings> bindingsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** 缓存条目：绑定列表 + 写入时刻。 */
    private record CachedBindings(List<Map<String, Object>> bindings, long cachedAt) {
        boolean fresh() {
            return System.currentTimeMillis() - cachedAt < CACHE_TTL_MILLIS;
        }
    }

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
            bindings = fetchBindings(token);
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
     * 取主体绑定：**短 TTL 缓存 + 失败重试一次**。

     *
     * <p>为什么必须加：原先每个请求都同步回源 core-platform，探测脚本连发数百请求时回源被打崩，
     * 大批请求被自己判成"认证中心不可达"（实测 261 条 403/500，而同一时刻单发登录平台是 200）。
     * 页面一次只发几个请求所以看不出来，但这属于"并发下自伤"，跟限流/抖动叠加就会让用户看到
     * 「接口不可用」。缓存 TTL 只有 60 秒：账号绑定关系变化最多晚一分钟生效，换来的是回源量按访问频次
     * 而不是按请求数增长。</p>
     * <p>重试只做一次：回源失败往往是瞬时抖动（连接被拒/超时），重试一次能挡掉大部分；
     * 连续两次失败仍如实报错，不静默放行（放行等于"看全部数据"，那是更严重的问题）。</p>
     */
    private List<Map<String, Object>> fetchBindings(String token) {
        CachedBindings cached = bindingsCache.get(token);
        if (cached != null && cached.fresh()) {
            return cached.bindings();
        }
        RuntimeException last = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
                ResponseEntity<Map> response = restTemplate.exchange(
                        platformUrl + "/api/v1/platform/merchants/mine",
                        HttpMethod.GET, new HttpEntity<>(headers), Map.class);
                List<Map<String, Object>> bindings = readBindings(response.getBody());
                if (bindingsCache.size() > CACHE_MAX_ENTRIES) {
                    bindingsCache.clear();
                }
                bindingsCache.put(token, new CachedBindings(bindings, System.currentTimeMillis()));
                return bindings;
            } catch (RuntimeException e) {
                last = e;
                log.warn("解析经营主体第 {} 次失败：{}", attempt, e.getMessage());
            }
        }
        throw last;
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
