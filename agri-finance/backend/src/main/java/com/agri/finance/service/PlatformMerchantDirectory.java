package com.agri.finance.service;

import com.agri.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 平台经营主体目录（跨进程只读，带调用方令牌）。
 *
 * <p>资金机构要绑到"平台真实存在的经营主体"上，而主体台账在 core-platform。
 * 金融不直连平台库（架构文档 V2.0：跨域取数走接口），也不用自己的服务账号 ——
 * 用调用方令牌才能让平台按"这个人有没有运营权限"裁决，换成服务账号等于绕过判据。</p>
 */
@Slf4j
@Service
public class PlatformMerchantDirectory {

    /** 展示用的主体摘要；平台字段变了也不至于把金融侧一起带崩。 */
    public record MerchantOption(String merchantId, String merchantName, String creditCode,
                                 String type, String verifyStatus) {
    }

    private final RestTemplate restTemplate = new RestTemplate();
    private final String platformUrl;

    public PlatformMerchantDirectory(@Value("${services.platform.url:}") String platformUrl) {
        this.platformUrl = platformUrl;
    }

    /** 按名称模糊搜主体（运营端绑定弹窗的下拉数据源）。 */
    public List<MerchantOption> search(String keyword) {
        // keyword 走 URI 模板变量交给 RestTemplate 编码：自己先 encode 再拼进字符串会被
        // 再编一次（%E4 → %25E4），中文关键词于是永远搜不到东西。
        Map<String, Object> body = call(platformUrl
                + "/api/v1/admin/merchants?page=1&size=30&keyword={keyword}",
                HttpMethod.GET, Map.of("keyword", keyword == null ? "" : keyword.trim()));
        Object data = body.get("data");
        List<MerchantOption> options = new ArrayList<>();
        if (data instanceof Map<?, ?> page && page.get("records") instanceof List<?> records) {
            records.forEach(item -> {
                MerchantOption option = toOption(item);
                if (option != null) {
                    options.add(option);
                }
            });
        }
        return options;
    }

    /**
     * 按主体号取名称。
     *
     * @return 平台没有这家主体时返回 null（调用方据此拒绝绑定，而不是写一个查不到的号）
     */
    public MerchantOption find(String merchantId) {
        if (merchantId == null || merchantId.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> body = call(platformUrl + "/api/v1/admin/merchants/" + merchantId.trim(),
                    HttpMethod.GET, Map.of());
            return body.get("data") == null ? null : toOption(body.get("data"));
        } catch (BusinessException e) {
            if (e.getCode() == 404) {
                return null;
            }
            throw e;
        }
    }

    private Map<String, Object> call(String url, HttpMethod method, Map<String, ?> uriVariables) {
        if (platformUrl == null || platformUrl.isBlank()) {
            throw new BusinessException(500, "未配置平台地址（services.platform.url），无法查询经营主体台账");
        }
        String authorization = FinanceIdentityService.currentAuthorization();
        if (authorization == null) {
            throw new BusinessException(401, "未登录：缺少平台访问令牌");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorization);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, method, new HttpEntity<>(headers), Map.class, uriVariables);
            Map<String, Object> body = response.getBody();
            if (body == null) {
                throw new BusinessException(502, "平台经营主体接口没有返回内容");
            }
            Object code = body.get("code");
            int numericCode = code instanceof Number number ? number.intValue() : -1;
            if (numericCode != 0) {
                String message = String.valueOf(body.getOrDefault("message", "平台拒绝了该请求"));
                // 403 的原因必须原样递到页面上：多半是当前账号没有平台运营权限
                throw new BusinessException(response.getStatusCode().value() == 200 ? 403
                        : response.getStatusCode().value(), message);
            }
            return body;
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException e) {
            int status = statusOf(e);
            if (status == 403 || status == 401) {
                throw new BusinessException(status, status == 401
                        ? "登录已过期，请重新登录后再查询经营主体"
                        : "你的账号没有平台运营端权限，无法查询经营主体台账（需要 SUPER_ADMIN 或 MARKET_OPS）");
            }
            log.warn("调用平台经营主体目录失败：{} {}", url, e.getMessage());
            throw new BusinessException(502, "平台经营主体台账暂不可达（" + e.getMessage() + "），请稍后重试");
        }
    }

    private int statusOf(RestClientException e) {
        if (e instanceof org.springframework.web.client.HttpStatusCodeException httpError) {
            return httpError.getStatusCode().value();
        }
        return 0;
    }

    private MerchantOption toOption(Object item) {
        if (!(item instanceof Map<?, ?> map)) {
            return null;
        }
        Object id = map.get("id");
        if (id == null) {
            return null;
        }
        Object name = map.get("name");
        return new MerchantOption(String.valueOf(id),
                name == null ? String.valueOf(id) : String.valueOf(name),
                text(map.get("creditCode")), text(map.get("type")), text(map.get("verifyStatus")));
    }

    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
