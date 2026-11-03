package com.agri.service.security;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.PermissionResolver;
import com.agri.common.rbac.PlatformPermissionResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 综合服务侧身份：当前登录账号 → 平台经营主体（需求方）/ 服务商档案（履约方）。
 *
 * <p><b>替换掉的旧做法</b>：这个模块原先<b>根本没有身份</b>。仓储层的 SQL 不带任何主体条件
 * （{@code SELECT * FROM service_order WHERE 1=1}），"我的订单/我的消息/我的保单"其实是全平台
 * 一份共享清单；服务商工作台把 {@code providerId} 放在查询串和路径里由前端自报，
 * 还有一个 {@code @RequestParam(defaultValue = "1")} 的默认值 —— 意思是任何人改一个号
 * 就能读别人的服务单、替别家服务商接单和上报进度；运营留痕的操作人则是代码里写死的
 * "王运营"，前端还会传"陈仲裁""刘结算"。</p>
 *
 * <p>口径与生产/交易/金融/监管同一套：主体一律由服务端从<b>访问令牌</b>推导
 * （转调 core-platform 的 {@code /api/v1/platform/merchants/mine}），服务商再按
 * {@code service_provider.merchant_id} 落到具体档案。解析不到一律报错并写清该找谁，
 * 绝不退化成"看全部""用 1 号"或"顶一个名字"。</p>
 */
@Slf4j
@Service
public class ServiceIdentityService {

    private static final String AUTHORIZATION = "Authorization";
    private static final String REQUEST_ATTR = ServiceIdentityService.class.getName() + ".merchant";
    /** 主体绑定缓存只用于合并同一页面的并发请求，切换当前主体要很快生效。 */
    private static final long CACHE_TTL_MILLIS = 2_000L;
    private static final int CACHE_MAX_ENTRIES = 500;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final PermissionResolver permissionResolver;
    private final String platformUrl;
    private final ConcurrentHashMap<String, CachedMerchant> merchantCache = new ConcurrentHashMap<>();

    private static volatile ServiceIdentityService instance;

    public ServiceIdentityService(JdbcTemplate jdbc,
                                  PermissionResolver permissionResolver,
                                  @Value("${services.platform.url:}") String platformUrl) {
        this.jdbc = jdbc;
        this.permissionResolver = permissionResolver;
        this.platformUrl = platformUrl;
        instance = this;
    }

    private record CachedMerchant(String merchantId, String merchantName, long cachedAt) {
        boolean fresh() {
            return System.currentTimeMillis() - cachedAt < CACHE_TTL_MILLIS;
        }
    }

    /** 当前账号绑定的平台经营主体号；没有绑定就报错，不猜。 */
    public String currentMerchantId() {
        return currentMerchant()[0];
    }

    /** 主体名称，解析不到时回退为主体号。 */
    public String currentMerchantName() {
        String[] merchant = currentMerchant();
        return merchant[1] == null || merchant[1].isBlank() ? merchant[0] : merchant[1];
    }

    /**
     * 当前登录服务商的档案主键（{@code service_provider.merchant_id} 绑定关系）。
     *
     * <p>接单、上报进度、看自己工单都必须落到具体档案：用前端传来的 providerId 等于
     * 让调用方自己声明"我是哪家服务商"。</p>
     */
    public long currentProviderId() {
        String merchantId = currentMerchantId();
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM service_provider WHERE merchant_id = ? AND status <> 'removed'",
                Long.class, Long.valueOf(merchantId));
        if (ids.isEmpty()) {
            throw BusinessException.forbidden("服务商档案里没有登记你的经营主体（" + merchantId + " "
                    + currentMerchantName() + "），请联系平台运营在「服务商台账」里完成绑定后再使用工作台");
        }
        return ids.get(0);
    }

    /** 当前服务商档案（工作台显示名称、类目、报价用）。 */
    public Map<String, Object> currentProviderRow(long providerId) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM service_provider WHERE id=?", providerId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("服务商档案不存在：" + providerId);
        }
        return rows.get(0);
    }

    /** 经营主体是否已绑定到某家服务商（前端据此决定能不能进工作台）。 */
    public boolean providerBound() {
        try {
            String merchantId = currentMerchantId();
            return !jdbc.queryForList("SELECT id FROM service_provider WHERE merchant_id = ?", Long.class,
                    Long.valueOf(merchantId)).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /** 平台用户号（令牌 sub），运营侧留痕要能追到人，而不只是一个角色名。 */
    public Long currentUserId() {
        String value = claim("sub");
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /**
     * 操作人姓名（写 {@code service_op_log} 与各审核字段用）。
     *
     * <p>取不到就返回 null，由调用方拒绝写入 —— 把操作人写成代码里的"王运营"，
     * 审计字段就变成了装饰，出事时查不到是谁做的。</p>
     */
    public String operatorName() {
        String nickname = claim("nickname");
        if (nickname != null && !nickname.isBlank()) {
            return nickname;
        }
        String username = claim("username");
        return username == null || username.isBlank() ? null : username;
    }

    /** 操作人角色（留痕用的一行描述）。 */
    public String operatorRole() {
        if (isOps()) {
            return "平台运营";
        }
        if (providerBound()) {
            return "服务商";
        }
        return "经营主体";
    }

    /** 要求必须有真实操作人，否则不允许写这条记录。 */
    public String requireOperatorName() {
        String name = operatorName();
        if (name == null || name.isBlank()) {
            throw BusinessException.unauthorized("登录态已失效，无法确认操作人，请重新登录后再提交");
        }
        return name;
    }

    public boolean hasPermission(String code) {
        try {
            // 用平台的判定口径而不是 Set#contains：超管拿的是通配 "*"，逐码 contains 永远为 false
            return PlatformPermissionResolver.granted(permissionResolver.currentPermissions(), code);
        } catch (Exception e) {
            log.warn("解析平台权限失败，按无权限处理：{}", e.getMessage());
            return false;
        }
    }

    /** 是否平台运营（可跨主体看台账、派单、复核）。 */
    public boolean isOps() {
        return hasPermission("service:admin");
    }

    /** 需求方只能读写自己主体下的记录；运营放行（用于工单、保单等私域判权）。 */
    public void assertOwner(Long ownerMerchantId, String what) {
        if (isOps()) {
            return;
        }
        long own = Long.parseLong(currentMerchantId());
        if (ownerMerchantId == null || ownerMerchantId != own) {
            throw BusinessException.forbidden(what + "不属于当前经营主体，无权查看或操作");
        }
    }

    /**
     * 私域数据范围：运营可按参数筛（为空 = 看全量台账），需求方一律只看自己。
     *
     * @return {@code null} 表示调用方是运营、不加主体过滤
     */
    public Long scopedMerchantId(Object requested) {
        if (isOps()) {
            if (requested == null || String.valueOf(requested).isBlank()) {
                return null;
            }
            try {
                return Long.valueOf(String.valueOf(requested).trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return Long.valueOf(currentMerchantId());
    }

    /**
     * 当前请求的 {@code Authorization} 头（原样，含 {@code Bearer } 前缀）。
     *
     * <p>综合服务是独立进程，需要跨域取数时必须带着调用方自己的令牌去换，
     * 否则对端无法判断"你有没有这个主体的数据范围"。</p>
     */
    public static String currentAuthorization() {
        ServiceIdentityService service = instance;
        if (service == null) {
            return null;
        }
        HttpServletRequest request = service.currentRequest();
        return request == null ? null : request.getHeader(AUTHORIZATION);
    }

    /** 当前请求的来源 IP（留痕用；经网关时取 X-Forwarded-For 的第一段）。 */
    public String clientIp() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return "unknown";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        return real != null && !real.isBlank() ? real.trim() : request.getRemoteAddr();
    }

    private String[] currentMerchant() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            throw BusinessException.forbidden("当前没有请求上下文，无法解析登录主体");
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof String[] hit) {
            return hit;
        }
        String token = bearerToken(request);
        if (token == null) {
            throw BusinessException.unauthorized("未登录：缺少平台访问令牌");
        }
        if (platformUrl == null || platformUrl.isBlank()) {
            throw BusinessException.forbidden("未配置平台地址（services.platform.url），无法解析登录主体");
        }
        String[] merchant;
        try {
            merchant = resolveMerchant(token);
        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            if (status == 401 || status == 403) {
                throw BusinessException.unauthorized("登录已过期或令牌无效，请重新登录");
            }
            throw BusinessException.forbidden("无法解析你的经营主体（平台认证中心返回 " + status + "），请稍后重试");
        } catch (Exception e) {
            log.warn("解析经营主体失败：{}", e.getMessage());
            throw BusinessException.forbidden("无法解析你的经营主体（平台认证中心不可达），请稍后重试");
        }
        request.setAttribute(REQUEST_ATTR, merchant);
        return merchant;
    }

    /**
     * 运营给服务商绑定平台主体前，先确认这个主体号在平台真的存在。
     * 绑一个不存在的号不会报错，只会让服务商工作台在登录时才炸——那是最难查的一类故障。
     */
    public String merchantNameOf(long merchantId) {
        if (platformUrl == null || platformUrl.isBlank()) {
            throw BusinessException.forbidden("未配置平台地址（services.platform.url），无法校验经营主体");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + currentToken());
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    platformUrl + "/api/v1/admin/merchants/" + merchantId,
                    HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Object data = response.getBody() == null ? null : response.getBody().get("data");
            if (!(data instanceof Map<?, ?> merchant)) {
                return null;
            }
            Object name = merchant.get("merchantName") != null ? merchant.get("merchantName") : merchant.get("name");
            return name == null ? null : String.valueOf(name);
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().value() == 404) {
                return null;
            }
            throw BusinessException.forbidden("平台返回 " + e.getStatusCode().value() + "，无法校验该经营主体");
        } catch (Exception e) {
            log.warn("校验经营主体 {} 失败：{}", merchantId, e.getMessage());
            throw BusinessException.forbidden("平台认证中心不可达，无法校验经营主体，请稍后重试");
        }
    }

    private String currentToken() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            throw BusinessException.unauthorized("没有请求上下文，无法取访问令牌");
        }
        String token = bearerToken(attributes.getRequest());
        if (token == null) {
            throw BusinessException.unauthorized("未登录：缺少平台访问令牌");
        }
        return token;
    }

    private String[] resolveMerchant(String token) {
        CachedMerchant cached = merchantCache.get(token);
        if (cached != null && cached.fresh()) {
            return new String[] {cached.merchantId(), cached.merchantName()};
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        ResponseEntity<Map> response = restTemplate.exchange(
                platformUrl + "/api/v1/platform/merchants/mine",
                HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        String[] merchant = readMerchant(response.getBody());
        if (merchant == null) {
            throw BusinessException.forbidden("当前账号还没有绑定经营主体，请联系平台运营在「用户-主体绑定」里配置后再使用综合服务");
        }
        if (merchantCache.size() > CACHE_MAX_ENTRIES) {
            merchantCache.clear();
        }
        merchantCache.put(token, new CachedMerchant(merchant[0], merchant[1], System.currentTimeMillis()));
        return merchant;
    }

    private String[] readMerchant(Map<String, Object> body) {
        if (body == null || !(body.get("data") instanceof List<?> list) || list.isEmpty()) {
            return null;
        }
        if (!(list.get(0) instanceof Map<?, ?> binding)) {
            return null;
        }
        Object merchantId = binding.get("merchantId");
        if (merchantId == null) {
            return null;
        }
        Object merchantName = binding.get("merchantName");
        return new String[] {String.valueOf(merchantId),
                merchantName == null ? null : String.valueOf(merchantName)};
    }

    /**
     * 读访问令牌里的声明。
     *
     * <p>这里<b>不做签名校验</b>：授权判定由 {@link PermissionResolver} 回源平台完成
     * （令牌无效时拦截器直接 403），这里只取"操作人是谁"用于留痕。</p>
     */
    private String claim(String key) {
        HttpServletRequest request = currentRequest();
        String token = request == null ? null : bearerToken(request);
        if (token == null) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        try {
            JsonNode value = objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1])).get(key);
            return value == null || value.isNull() ? null : value.asText();
        } catch (Exception e) {
            return null;
        }
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
