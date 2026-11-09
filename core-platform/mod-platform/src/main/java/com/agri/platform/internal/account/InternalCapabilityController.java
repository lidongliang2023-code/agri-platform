package com.agri.platform.internal.account;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.api.facade.CapabilityFacade;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 内部能力校验：给**独立部署的子系统**（如 agri-finance）用。
 *
 * <p>这些子系统不共享 mod-platform 的类加载器，没法直接调 {@link CapabilityFacade}，
 * 但又不想各自抄一份"谁是认证主体"的判断。这里用一次 HTTP 调用把判定收归一处。</p>
 *
 * <p><b>两道门</b>：① 必须带平台访问令牌（userId 从令牌解析，调用方不能自报）；</p>
 * <p>② 必须带内部令牌 `X-Internal-Token`（服务间共享密钥，避免这个端点被外部直接刷）。</p>
 */
@RestController
@RequestMapping("/api/v1/internal")
@RequiredArgsConstructor
public class InternalCapabilityController {

    private final CapabilityFacade capabilityFacade;

    @Value("${agri.internal.token:agri-internal-dev}")
    private String internalToken = "agri-internal-dev";

    @PostMapping("/capability-check")
    public ApiResponse<Map<String, Object>> check(@RequestHeader(value = "X-Internal-Token", required = false) String token,
                                                  @RequestBody CapabilityCheckRequest body) {
        if (token == null || !token.equals(internalToken)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "内部令牌无效");
        }
        Long userId = MarketContext.currentUserId();
        Map<String, Object> result = new LinkedHashMap<>();
        if (userId == null) {
            result.put("granted", false);
            result.put("reason", "请先登录");
            return ApiResponse.ok(result);
        }
        String code = body == null ? null : body.code();
        if ("production.manage".equals(code)
                && (body.merchantId() == null || body.merchantId() <= 0)) {
            result.put("granted", false);
            result.put("reason", "请先选择本次业务所属的经营主体");
            result.put("code", code);
            return ApiResponse.ok(result);
        }
        CapabilityFacade.Decision decision = capabilityFacade.check(userId, code, body == null ? null : body.merchantId());
        result.put("granted", decision.granted());
        result.put("reason", decision.reason());
        result.put("code", code);
        return ApiResponse.ok(result);
    }

    /** 校验入参：能力码 + 可选的主体 ID */
    public record CapabilityCheckRequest(String code, Long merchantId) {
    }
}
