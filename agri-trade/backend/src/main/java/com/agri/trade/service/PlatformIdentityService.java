package com.agri.trade.service;

import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.feign.PlatformFeignClient;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * 身份解析：当前登录用户 → 经营主体（身份基建第 2 步）。
 *
 * <p><b>它替换掉的旧做法</b>：用户端的订单/纠纷列表原先由**前端**把登录用户 id 当参与方传上来
 * （{@code participantId}）。那有两个问题：一是平台用户 id 与交易表里的经营主体号不是一套，
 * 传上来永远查不到（"看起来在过滤、其实永远为空"）；二是只要换个 id 就能看别人的单据 ——
 * 范围是调用方自报的，等于没有范围。</p>
 *
 * <p>现在改成：范围一律由服务端从**令牌**推导。前端不再传，也无从伪造。</p>
 *
 * <p><b>取数方式</b>：调 core-platform 的 {@code /api/v1/platform/merchants/mine}（转发令牌），
 * 不直连平台库（架构文档 V2.0：跨域取数走接口）。结果按请求缓存一次 ——
 * 详情页既要判权限、又要校验主体，一次请求里只应回源一次。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformIdentityService {

    /** 请求级缓存键（挂在 HttpServletRequest 上，请求结束自动回收，不会串号）。 */
    private static final String REQUEST_ATTR = PlatformIdentityService.class.getName() + ".scope";

    private final PlatformFeignClient platformFeignClient;

    /**
     * 当前用户绑定的经营主体。
     *
     * @param resolved  是否解析成功（false 表示身份服务不可达 —— 这时不能退化成"看全部"）
     * @param bindings  原始绑定行（给"我的主体"展示用）
     * @param error     解析失败的原因（resolved=false 时非空）
     */
    public record MerchantScope(boolean resolved, List<Long> merchantIds,
                                List<Map<String, Object>> bindings, String error) {

        public boolean hasBinding() {
            return !merchantIds.isEmpty();
        }

        /** 我绑定的主体里，编号等于给定值的那个主体的名称；不属于我则返回 null。 */
        public String nameOf(Long merchantId) {
            if (merchantId == null) {
                return null;
            }
            for (Map<String, Object> binding : bindings) {
                if (merchantId.equals(toLong(binding.get("merchantId")))) {
                    return str(binding.get("merchantName"));
                }
            }
            return null;
        }

        static MerchantScope ok(List<Map<String, Object>> bindings) {
            LinkedHashSet<Long> ids = new LinkedHashSet<>();
            for (Map<String, Object> binding : bindings) {
                Long id = toLong(binding.get("merchantId"));
                if (id != null) {
                    ids.add(id);
                }
            }
            return new MerchantScope(true, new ArrayList<>(ids), bindings, null);
        }

        static MerchantScope unresolved(String error) {
            return new MerchantScope(false, List.of(), List.of(), error);
        }
    }

    /** 选定"以哪个主体发起交易"的结果。error 非空即失败，调用方直接把 error 返回给前端。 */
    public record MerchantSelection(Long merchantId, String merchantName, String roleInMerchant, String error) {

        public boolean ok() {
            return error == null;
        }

        static MerchantSelection of(Long id, String name, String role) {
            return new MerchantSelection(id, name, role, null);
        }

        static MerchantSelection fail(String error) {
            return new MerchantSelection(null, null, null, error);
        }
    }

    /** 解析当前用户的经营主体（请求内缓存）。 */
    public MerchantScope currentScope() {
        HttpServletRequest request = SecurityUtils.getRequest();
        if (request != null) {
            Object cached = request.getAttribute(REQUEST_ATTR);
            if (cached instanceof MerchantScope scope) {
                return scope;
            }
        }
        MerchantScope scope = resolve();
        if (request != null) {
            request.setAttribute(REQUEST_ATTR, scope);
        }
        return scope;
    }

    /**
     * 选一个主体作为本次交易的"我方"。
     *
     * @param requested 请求里点名的主体号（可为空）。**必须属于自己** —— 不校验就等于让人
     *                  以别人的名义下单；一个人绑了多家时不自动挑，宁可报错也不猜。
     */
    public MerchantSelection selectMerchant(Long requested) {
        MerchantScope scope = currentScope();
        if (!scope.resolved()) {
            return MerchantSelection.fail(scope.error());
        }
        if (!scope.hasBinding()) {
            return MerchantSelection.fail("当前账号还没有绑定经营主体，无法以采购方身份发起交易（请联系运营在「用户-主体绑定」里配置）");
        }
        if (requested != null) {
            for (Map<String, Object> binding : scope.bindings()) {
                Long id = toLong(binding.get("merchantId"));
                if (requested.equals(id)) {
                    return MerchantSelection.of(id, str(binding.get("merchantName")), str(binding.get("roleInMerchant")));
                }
            }
            return MerchantSelection.fail("你无权以该经营主体发起交易");
        }
        if (scope.merchantIds().size() == 1) {
            Map<String, Object> only = scope.bindings().get(0);
            return MerchantSelection.of(scope.merchantIds().get(0), str(only.get("merchantName")),
                    str(only.get("roleInMerchant")));
        }
        return MerchantSelection.fail("你的账号绑定了多家经营主体，请先指定 merchantId");
    }

    /** 当前用户是否属于给定主体之一（详情页判权复用同一份口径）。 */
    public boolean belongsTo(List<Long> merchantIds, Long candidate) {
        return candidate != null && merchantIds.contains(candidate);
    }

    private MerchantScope resolve() {
        String token = SecurityUtils.getToken();
        if (token == null || token.isEmpty()) {
            return MerchantScope.unresolved("未登录：缺少访问令牌");
        }
        Map<String, Object> response;
        try {
            response = platformFeignClient.myMerchants("Bearer " + token);
        } catch (Exception e) {
            // 平台不可达绝不能退化成"没有范围"（那就是全量）。宁可报错，让页面显示得出来。
            log.warn("解析经营主体失败：{}", e.getMessage());
            return MerchantScope.unresolved("暂时无法解析您的经营主体（平台身份服务不可达），请稍后重试");
        }
        if (response == null) {
            return MerchantScope.unresolved("暂时无法解析您的经营主体（平台返回空响应），请稍后重试");
        }
        Object code = response.get("code");
        if (code != null && !"0".equals(String.valueOf(code)) && !"200".equals(String.valueOf(code))) {
            String message = str(response.get("message"));
            return MerchantScope.unresolved(message != null ? message : "解析经营主体失败");
        }
        Object data = response.get("data");
        if (!(data instanceof List<?> list)) {
            // 已认证但没有绑定 —— 这是合法状态（空范围），返回空集而不是报错。
            return MerchantScope.ok(List.of());
        }
        List<Map<String, Object>> bindings = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) map;
                bindings.add(row);
            }
        }
        return MerchantScope.ok(bindings);
    }

    private static Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isEmpty()) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
