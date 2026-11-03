package com.agri.government.security;

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
 * 政府监管侧身份：当前登录账号 → 监管主体档案（gov_subject）/ 执法人员档案（gov_user）。
 *
 * <p><b>替换掉的旧做法</b>：Repository 的 SQL 里到处写死 {@code subject_id=1} 与
 * {@code '王磊'}、{@code '张科长'}。后果不是"少了一个筛选条件"这么简单：
 * 任何账号登录都看到绿源蔬菜专业合作社的证照、整改、处罚与站内信，
 * 而执法人员移动端永远显示王磊的任务 —— 数据范围由代码写死，等于没有范围，
 * 也让人误以为"别家主体的监管记录不存在"。</p>
 *
 * <p>口径与交易/生产/金融模块同一套：主体一律由服务端从<b>访问令牌</b>推导
 * （转调 core-platform 的 {@code /api/v1/platform/merchants/mine}），再按
 * {@code gov_subject.merchant_id} 落到监管档案；执法人员按 {@code gov_user.platform_user_id} 落到人。
 * 解析不到一律报错并给出可操作的原因，绝不退化成"看全部"或"用第一个"。</p>
 */
@Slf4j
@Service
public class GovernmentIdentityService {

    private static final String AUTHORIZATION = "Authorization";
    private static final String REQUEST_ATTR = GovernmentIdentityService.class.getName() + ".merchant";
    private static final long CACHE_TTL_MILLIS = 2_000L;
    private static final int CACHE_MAX_ENTRIES = 500;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final PermissionResolver permissionResolver;
    private final String platformUrl;
    private final ConcurrentHashMap<String, CachedMerchant> merchantCache = new ConcurrentHashMap<>();

    private static volatile GovernmentIdentityService instance;

    public GovernmentIdentityService(JdbcTemplate jdbc,
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

    /** 当前账号绑定的平台经营主体号（没有绑定就报错，不猜）。 */
    public String currentMerchantId() {
        return currentMerchant()[0];
    }

    public String currentMerchantName() {
        String[] merchant = currentMerchant();
        return merchant[1] == null || merchant[1].isBlank() ? merchant[0] : merchant[1];
    }

    /**
     * 当前账号对应的监管主体档案主键（gov_subject.id）。
     *
     * <p>平台有主体但监管档案里没登记它，是"两条业务线各自建过数据"的真实状态，
     * 所以原因要写清楚该找谁：运营在监管主体台账里绑定平台经营主体。</p>
     */
    public long currentSubjectId() {
        String merchantId = currentMerchantId();
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM gov_subject WHERE merchant_id = ?", Long.class, Long.valueOf(merchantId));
        if (ids.isEmpty()) {
            throw BusinessException.forbidden("监管主体档案里没有登记你的经营主体（" + merchantId + " "
                    + currentMerchantName() + "），请联系平台运营在「监管主体台账」里完成绑定");
        }
        return ids.get(0);
    }

    /** 当前主体档案（给页面显示主体名、信用分等）。 */
    public Map<String, Object> currentSubject() {
        long subjectId = currentSubjectId();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM gov_subject WHERE id = ?", subjectId);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    public boolean subjectBound() {
        try {
            String merchantId = currentMerchantId();
            return !jdbc.queryForList("SELECT id FROM gov_subject WHERE merchant_id = ?", Long.class,
                    Long.valueOf(merchantId)).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 当前执法人员档案（gov_user.id + 姓名 + 执法证号 + 网格）。
     *
     * @return 解析不到返回 null —— 移动执法端要求必须是执法人员；运营端只需要操作人姓名做留痕
     */
    public Map<String, Object> currentInspector() {
        String userId = claim("sub");
        if (userId == null || userId.isBlank()) {
            return null;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, name, role_name, organization, grid_name, certificate_no FROM gov_user"
                        + " WHERE platform_user_id = ? AND status = 'active'", Long.valueOf(userId));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 当前执法人员档案主键；不是执法人员就明确拒绝（不用一个写死的名字顶上）。 */
    public long currentInspectorId() {
        Map<String, Object> inspector = currentInspector();
        if (inspector == null) {
            throw BusinessException.forbidden("当前账号还没有绑定执法人员档案（gov_user.platform_user_id），"
                    + "移动执法端无法确定操作人身份，请联系平台运营开通执法账号");
        }
        return ((Number) inspector.get("id")).longValue();
    }

    /**
     * 操作人姓名（写执法留痕 gov_op_log 与分派快照用）。
     *
     * <p>优先取执法人员档案里的姓名，其次取令牌里的用户名；两者都拿不到时返回 null，
     * 由调用方拒绝操作 —— 留痕写成"张科长"这种代码里的常量，等于把审计字段变成装饰。</p>
     */
    public String operatorName() {
        Map<String, Object> inspector = currentInspector();
        if (inspector != null) {
            return String.valueOf(inspector.get("name"));
        }
        String nickname = claim("nickname");
        if (nickname != null && !nickname.isBlank()) {
            return nickname;
        }
        String username = claim("username");
        return username == null || username.isBlank() ? null : username;
    }

    /** 操作人角色（执法留痕里的 role_name）：有档案用档案，否则用令牌里的角色描述。 */
    public String operatorRole() {
        Map<String, Object> inspector = currentInspector();
        if (inspector != null && inspector.get("role_name") != null) {
            return String.valueOf(inspector.get("role_name"));
        }
        return hasPermission("gov:inspector") ? "执法人员" : "监管运营人员";
    }

    public boolean hasPermission(String code) {
        try {
            return PlatformPermissionResolver.granted(permissionResolver.currentPermissions(), code);
        } catch (Exception e) {
            log.warn("解析平台权限失败，按无权限处理：{}", e.getMessage());
            return false;
        }
    }

    /** 是否监管运营（可跨主体看台账、分派任务、复核）。 */
    public boolean isOps() {
        return hasPermission("gov:admin");
    }

    /** 是否移动执法人员。 */
    public boolean isInspector() {
        return hasPermission("gov:inspector");
    }

    /**
     * 数据范围：运营可按参数筛（为空 = 看全量台账）；主体端一律只看自己那份档案。
     *
     * @return {@code null} 表示调用方是运营、不加主体过滤
     */
    public Long scopedSubjectId(Object requested) {
        if (isOps() || isInspector()) {
            Long parsed = toLong(requested);
            return parsed;
        }
        return currentSubjectId();
    }

    /** 主体端只能读写自己档案下的记录。 */
    public void assertSubjectOwns(Long subjectId) {
        if (isOps() || isInspector()) {
            return;
        }
        long own = currentSubjectId();
        if (subjectId == null || subjectId != own) {
            throw BusinessException.forbidden("该监管记录不属于当前经营主体，无权查看或操作");
        }
    }

    /** 当前请求的 Authorization 头（原样，含 Bearer 前缀），跨域取数要带调用方自己的令牌。 */
    public static String currentAuthorization() {
        GovernmentIdentityService service = instance;
        if (service == null) {
            return null;
        }
        HttpServletRequest request = service.currentRequest();
        return request == null ? null : request.getHeader(AUTHORIZATION);
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
            throw BusinessException.forbidden("当前账号还没有绑定经营主体，请联系平台运营在「用户-主体绑定」里配置后再使用监管服务");
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
     * （令牌无效时拦截器直接 403），这里只取"操作人是谁"用于执法留痕与档案匹配，
     * 不参与权限与数据范围之外的任何决策。</p>
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

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty() || "null".equals(text) || "all".equals(text)) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
