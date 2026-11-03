package com.agri.finance.service;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.PermissionResolver;
import com.agri.common.rbac.PlatformPermissionResolver;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.mapper.FundProviderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 金融侧身份：当前登录账号 → 融资主体（经营主体号）/ 资金机构。
 *
 * <p><b>替换掉的旧做法</b>：融资方、资金方身份由<b>前端自报</b>
 * （{@code financeUser.id='2001'}、{@code fundProvider.id='PROVIDER-BANK-001'}），
 * 后端再按传入的 userId 过滤。两个后果：一是所有人登录后看到的都是 2001 的单据，
 * 二是把参数换成别人的主体号就能读到、也能操作别人的借款与还款 —— 范围由被请求方
 * 自己声明，等于没有范围。</p>
 *
 * <p>口径与交易/生产模块同一套：主体一律由服务端从<b>访问令牌</b>推导
 * （转调 core-platform 的 {@code /api/v1/platform/merchants/mine}），
 * 金融侧的 {@code user_id} 存的就是这个经营主体号。解析不到一律报错，
 * 绝不退化成"看全部"。</p>
 */
@Slf4j
@Service
public class FinanceIdentityService {

    private static final String AUTHORIZATION = "Authorization";
    private static final String REQUEST_ATTR = FinanceIdentityService.class.getName() + ".merchant";

    /** 主体绑定缓存：只用于合并同一页面发出的并发请求，切换当前主体要很快生效。 */
    private static final long CACHE_TTL_MILLIS = 2_000L;
    private static final int CACHE_MAX_ENTRIES = 500;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final FundProviderMapper fundProviderMapper;
    private final PermissionResolver permissionResolver;
    private final String platformUrl;
    private final java.util.concurrent.ConcurrentHashMap<String, CachedMerchant> merchantCache =
            new java.util.concurrent.ConcurrentHashMap<>();

    /** 静态自引用：主体号是"环境量"，控制器与定时任务之外的地方也要能取到当前请求的令牌。 */
    private static volatile FinanceIdentityService instance;

    public FinanceIdentityService(FundProviderMapper fundProviderMapper,
                                  PermissionResolver permissionResolver,
                                  @Value("${services.platform.url:}") String platformUrl) {
        this.fundProviderMapper = fundProviderMapper;
        this.permissionResolver = permissionResolver;
        this.platformUrl = platformUrl;
        instance = this;
    }

    private record CachedMerchant(String merchantId, String merchantName, long cachedAt) {
        boolean fresh() {
            return System.currentTimeMillis() - cachedAt < CACHE_TTL_MILLIS;
        }
    }

    /**
     * 当前登录账号绑定的经营主体号（= 金融表里的 user_id）。
     *
     * @throws BusinessException 401 未登录 / 403 未绑定主体 / 500 平台不可达
     */
    public String currentBorrowerId() {
        return currentMerchant()[0];
    }

    /** 当前主体名称，解析不到时回退为主体号。 */
    public String currentBorrowerName() {
        String[] merchant = currentMerchant();
        return merchant[1] == null || merchant[1].isBlank() ? merchant[0] : merchant[1];
    }

    /**
     * 当前资金机构。
     *
     * <p>资金方账号必须在 {@code fund_provider.merchant_id} 上绑定到某个经营主体，
     * 否则不能进入资金工作台 —— 由谁审批、资金额度占用、投资组合都挂在这个绑定上，
     * 猜一个机构号会让 A 银行的审批落到 B 银行的额度上。</p>
     */
    public String currentProviderId() {
        return currentProvider().getId();
    }

    /** 当前登录者绑定的资金机构（未绑定一律 403，绝不猜一个机构号顶上去）。 */
    public FundProvider currentProvider() {
        FundProvider provider = findProvider(currentBorrowerId());
        if (provider == null) {
            throw new BusinessException(403,
                    "当前账号（主体 " + currentBorrowerId() + "）还没有绑定资金机构，请联系平台运营在资金机构里绑定");
        }
        return provider;
    }

    /**
     * 当前账号名下的收件箱：融资主体 + 已绑定的资金机构。
     *
     * <p>消息表的 {@code user_id} 两种收件人都有（融资方挂主体号、资金方挂机构号），
     * 所以判"这条消息是不是你的"要同时看这两个身份。</p>
     */
    public Set<String> ownInboxes() {
        String merchantId = currentBorrowerId();
        LinkedHashSet<String> inboxes = new LinkedHashSet<>();
        inboxes.add(merchantId);
        FundProvider provider = findProvider(merchantId);
        if (provider != null) {
            inboxes.add(provider.getId());
        }
        return inboxes;
    }

    /**
     * 校验收件人属于当前账号，空白时默认取融资主体收件箱。
     *
     * @return 实际应查询的收件人
     */
    public String resolveInbox(String requested) {
        Set<String> mine = ownInboxes();
        if (requested == null || requested.isBlank()) {
            return mine.iterator().next();
        }
        String recipient = requested.trim();
        if (!mine.contains(recipient)) {
            throw new BusinessException(403, "消息收件人不属于当前账号：" + recipient);
        }
        return recipient;
    }

    /**
     * 资金机构号：以调用方绑定的机构为准。
     *
     * <p>运营角色（{@code finance:admin}）可以点名看某家机构（运营端要跨机构核对），
     * 普通资金方传了别家的机构号直接拒 —— 否则 A 银行能按 B 银行的机构号提交审批、
     * 配置 B 银行的投资组合。</p>
     */
    public String providerIdFor(String requested) {
        FundProvider mine = currentProvider();
        if (requested == null || requested.isBlank() || requested.trim().equals(mine.getId())) {
            return mine.getId();
        }
        if (hasPermission("finance:admin")) {
            return requested.trim();
        }
        throw new BusinessException(403,
                "你绑定的资金机构是「" + mine.getInstitutionName() + "」，不能以其他机构名义操作");
    }

    private FundProvider findProvider(String merchantId) {
        return fundProviderMapper.selectOne(new LambdaQueryWrapper<FundProvider>()
                .eq(FundProvider::getMerchantId, merchantId)
                .eq(FundProvider::getDelFlag, 0)
                .last("LIMIT 1"));
    }

    /** 平台侧的用户号与用户名（审批人、放款操作人留痕用，取自令牌声明而不是前端参数）。 */
    public String currentOperatorId() {
        String value = claim("sub");
        return value == null || value.isBlank() ? currentBorrowerId() : value;
    }

    public String currentOperatorName() {
        String value = claim("username");
        return value == null || value.isBlank() ? "金融审批人员" : value;
    }

    /**
     * 调用方是否持有指定权限码。
     *
     * <p>权限解析失败时返回 false（fail closed）—— 拿不准就按最小权限处理，
     * 融资方与运营方的数据范围靠它区分，误判成"运营方"等于放开全量数据。</p>
     */
    public boolean hasPermission(String code) {
        try {
            // 用平台的判定口径而不是 Set#contains：超管拿的是通配 "*"，逐码 contains 永远为 false
            return PlatformPermissionResolver.granted(permissionResolver.currentPermissions(), code);
        } catch (Exception e) {
            log.warn("解析平台权限失败，按无权限处理：{}", e.getMessage());
            return false;
        }
    }

    /** 是否平台侧运营角色（可跨主体查看审批池、逾期、质押）。 */
    public boolean isOperator() {
        return hasPermission("finance:admin") || hasPermission("finance:review");
    }

    /**
     * 数据范围：运营/审批角色可按参数筛（参数为空 = 看全部台账），
     * 融资方一律只看自己 —— 返回 {@code null} 表示"调用方是运营，不加主体过滤"。
     */
    public String scopedBorrowerId(String requested) {
        if (isOperator()) {
            return requested == null || requested.isBlank() ? null : requested.trim();
        }
        return currentBorrowerId();
    }

    /** 融资方只能读写自己的单据；运营角色放行。 */
    public void assertBorrowerOwns(String ownerId) {
        String own = currentBorrowerId();
        if (!own.equals(ownerId) && !isOperator()) {
            throw new BusinessException(403, "该单据不属于当前融资主体，无权操作");
        }
    }

    private String[] currentMerchant() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            throw new BusinessException(500, "当前没有请求上下文，无法解析融资主体");
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof String[] hit) {
            return hit;
        }
        String token = bearerToken(request);
        if (token == null) {
            throw new BusinessException(401, "未登录：缺少平台访问令牌");
        }
        if (platformUrl == null || platformUrl.isBlank()) {
            throw new BusinessException(500, "未配置平台地址（services.platform.url），无法解析融资主体");
        }
        String[] merchant;
        try {
            merchant = resolveMerchant(token);
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                throw new BusinessException(401, "登录已过期或令牌无效，请重新登录");
            }
            log.warn("解析融资主体失败：{}", e.getMessage());
            throw new BusinessException(500, "无法解析你的经营主体（平台认证中心返回 "
                    + e.getStatusCode().value() + "），请稍后重试");
        } catch (Exception e) {
            log.warn("解析融资主体失败：{}", e.getMessage());
            throw new BusinessException(500, "无法解析你的经营主体（平台认证中心不可达），请稍后重试");
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
            throw new BusinessException(403,
                    "当前账号还没有绑定经营主体，请联系平台运营在「用户-主体绑定」里配置后再申请融资");
        }
        if (merchantCache.size() > CACHE_MAX_ENTRIES) {
            merchantCache.clear();
        }
        merchantCache.put(token, new CachedMerchant(merchant[0], merchant[1], System.currentTimeMillis()));
        return merchant;
    }

    @SuppressWarnings("unchecked")
    private String[] readMerchant(Map<String, Object> body) {
        if (body == null || !(body.get("data") instanceof List<?> list) || list.isEmpty()) {
            return null;
        }
        Object first = list.get(0);
        if (!(first instanceof Map<?, ?> binding)) {
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
     * 读取访问令牌里的 JWT 声明。
     *
     * <p>这里<b>不做签名校验</b>：授权判定已经由 {@link PermissionResolver} 回源平台完成
     * （令牌无效时拦截器直接 403），这里只取"操作人是谁"用于留痕，
     * 不参与任何权限或数据范围决策。</p>
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

    /**
     * 当前请求的 {@code Authorization} 头（原样，含 {@code Bearer } 前缀）。
     *
     * <p>金融是独立进程，运营端要看的经营主体清单在平台侧 —— 跨进程取数必须带着
     * 调用方自己的令牌去换，否则平台无法判断"你有没有运营权限"，
     * 换成服务账号又会把权限判据抹平。</p>
     */
    public static String currentAuthorization() {
        FinanceIdentityService service = instance;
        if (service == null) {
            return null;
        }
        HttpServletRequest request = service.currentRequest();
        return request == null ? null : request.getHeader(AUTHORIZATION);
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
