package com.agri.masterdata.security;

import com.agri.common.constant.ErrorCode;
import com.agri.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 企业端「主体上下文」解析。
 *
 * <p><b>要解决的问题</b>：主数据后端的非管理端接口按 {@code tenant_id} 过滤，而平台访问令牌里
 * 只有 {@code marketId}、没有主体（租户）声明 —— 于是 {@code SecurityUtils.getTenantId()} 恒为 null，
 * 所有"我的组织 / 我的成员 / 我的客户"要么查到全量、要么什么都查不到。企业端因此长期无法开工。</p>
 *
 * <p><b>为什么不能直接信任请求头</b>：{@code X-Agri-Merchant} 由前端填写，谁都能改成别人的主体 id。
 * 所以这里每次都用**同一个用户令牌**回源 core-platform 的 {@code /platform/merchants/mine}，
 * 确认该用户确实属于这个主体；验证结果按 (userId, merchantId) 缓存 60 秒，避免每个请求都多一次网络往返。</p>
 *
 * <p>运营端调用不会带这个头，因此 {@code tenantId} 仍为 null，跨主体视图不受影响。</p>
 */
@Slf4j
@Service
public class MerchantContextResolver {

    /** 前端携带主体 id 的请求头（仅企业端）。 */
    public static final String MERCHANT_HEADER = "X-Agri-Merchant";

    private static final long CACHE_TTL_MS = 60_000L;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String platformUrl;
    private final Map<String, Long> verifiedAt = new ConcurrentHashMap<>();

    public MerchantContextResolver(@Value("${services.platform.url}") String platformUrl) {
        this.platformUrl = platformUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * 校验并返回可信的租户 id。
     *
     * @param merchantId 请求头里的主体 id（空值表示未提供，返回 null 由调用方决定是否拒绝）
     * @param token      当前用户的平台访问令牌（不含 Bearer 前缀）
     */
    public String resolve(String merchantId, String token) {
        if (merchantId == null || merchantId.isBlank()) {
            return null;
        }
        String normalized = merchantId.trim();
        if (!normalized.matches("[0-9]{1,20}")) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR, "主体 id 格式不正确");
        }
        String key = cacheKey(normalized, token);
        Long checkedAt = verifiedAt.get(key);
        if (checkedAt != null && System.currentTimeMillis() - checkedAt < CACHE_TTL_MS) {
            return normalized;
        }

        boolean member = isMemberOf(normalized, token);
        if (!member) {
            // 不写缓存：用户可能刚被加入主体，下一次请求应该能立刻生效
            verifiedAt.remove(key);
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "当前账号不属于该经营主体");
        }
        verifiedAt.put(key, System.currentTimeMillis());
        return normalized;
    }

    /** 缓存键用令牌摘要而不是令牌原文：日志 / 堆快照里不该出现可用凭证。 */
    private String cacheKey(String merchantId, String token) {
        String tokenPart = token == null ? "-" : Integer.toHexString(token.hashCode());
        return tokenPart + "|" + merchantId;
    }

    private boolean isMemberOf(String merchantId, String token) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            ResponseEntity<String> response = restTemplate.exchange(
                    platformUrl + "/api/v1/platform/merchants/mine",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            int code = root.path("code").asInt(-1);
            if (code != 0 && code != 200) {
                // 令牌被平台判无效：直接按未登录处理，别让用户看到"无权访问该主体"这种误导性文案
                throw new BusinessException(ErrorCode.USER_TOKEN_INVALID);
            }
            for (JsonNode item : root.path("data")) {
                if (merchantId.equals(item.path("merchantId").asText())) {
                    return true;
                }
            }
            return false;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("主体校验失败：{}", e.getMessage());
            // 校验服务不可用时不能默认放行，也不能伪装成"无权访问"
            throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE, "主体校验服务暂不可用，请稍后重试");
        }
    }
}
