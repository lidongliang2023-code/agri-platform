package com.agri.platform.internal.merchant;

import com.agri.platform.api.facade.CapabilityFacade;
import com.agri.platform.internal.account.IdentityApplicationEntity;
import com.agri.platform.internal.account.IdentityApplicationMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 供应商入驻审核通过后的「业务身份 + 供货能力」开通。
 *
 * <p><b>为什么放在平台侧</b>：业务身份（{@code platform_identity_application}）与
 * 经营主体绑定（{@code platform_user_merchant}）都属于平台域数据，S2B2C 库不持有。
 * 子系统审核通过后调用这里，由平台统一落库，能力判定仍由 {@link CapabilityFacade} 计算，
 * 避免两边各写一套"谁算供应商"的口径。</p>
 *
 * <p><b>两道门</b>：{@code X-Internal-Token} 服务间密钥；调用方不能伪造 userId 以外的东西 ——
 * userId 由 S2B2C 入库时绑定，不在审核请求里由前端自报。</p>
 */
@RestController
@RequestMapping("/api/v1/internal/supplier-onboarding")
@RequiredArgsConstructor
public class SupplierOnboardingInternalController {

    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final IdentityApplicationMapper identityApplicationMapper;
    private final CapabilityFacade capabilityFacade;

    @Value("${agri.internal.token:agri-internal-dev}")
    private String internalToken = "agri-internal-dev";

    /**
     * 开通供应商的业务身份与供货能力。
     *
     * <p>幂等：已有绑定/已通过身份直接复用；审核中的身份直接置为通过；
     * 只有都没有时才新建。重复调用不会产生第二套主体或第二条身份。</p>
     */
    @PostMapping("/grant")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> grant(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody GrantRequest body) {
        if (token == null || !token.equals(internalToken)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "内部令牌无效");
        }
        if (body == null || body.userId() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "缺少申请账号 userId");
        }
        Long marketId = body.marketId() == null ? 1L : body.marketId();
        String identityType = body.identityType() == null || body.identityType().isBlank()
                ? "mall_supplier" : body.identityType().trim();

        Long merchantId = ensureMerchantBinding(body, marketId);
        IdentityApplicationEntity identity = ensureApprovedIdentity(body, merchantId, identityType);

        CapabilityFacade.Decision decision = capabilityFacade.check(body.userId(),
                "s2b2c.supplier", merchantId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("userId", body.userId());
        data.put("merchantId", merchantId);
        data.put("identityType", identityType);
        data.put("identityApplicationId", identity.getId());
        data.put("capabilityGranted", decision.granted());
        data.put("capabilityReason", decision.reason());
        return ApiResponse.ok(data);
    }

    /**
     * 确保申请人有一个经营主体绑定。
     *
     * <p>已有绑定直接复用（一个人可能已经在多家主体任职，新增一条会把"当前主体"搞乱）；
     * 没有时才用入驻企业信息建主体并绑定为负责人。</p>
     */
    private Long ensureMerchantBinding(GrantRequest body, Long marketId) {
        UserMerchantEntity binding = userMerchantMapper.selectOne(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, body.userId())
                        .eq(UserMerchantEntity::getStatus, 1)
                        .orderByAsc(UserMerchantEntity::getId)
                        .last("LIMIT 1"));
        if (binding != null && binding.getMerchantId() != null) {
            return binding.getMerchantId();
        }

        MerchantEntity merchant = new MerchantEntity();
        merchant.setCode("MER" + System.currentTimeMillis());
        merchant.setName(body.companyName() == null || body.companyName().isBlank()
                ? ("供应商" + body.userId()) : body.companyName().trim());
        merchant.setType("SUPPLIER");
        merchant.setMemberType("enterprise");
        merchant.setCreditCode(body.creditCode());
        merchant.setContactName(body.contactName());
        merchant.setContactPhone(body.contactPhone());
        merchant.setStatus(1);
        // 入驻审核通过即视为主体资料已核验；后续如需更严格的资质认证，可再走主体认证流程
        merchant.setVerifyStatus("approved");
        merchant.setVerifyTime(LocalDateTime.now());
        merchant.setVerifyRemark("供应商入驻审核通过");
        merchant.setMarketId(marketId);
        merchantMapper.insert(merchant);

        UserMerchantEntity entity = new UserMerchantEntity();
        entity.setUserId(body.userId());
        entity.setMerchantId(merchant.getId());
        entity.setMarketId(marketId);
        entity.setRoleInMerchant("owner");
        entity.setStatus(1);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        userMerchantMapper.insert(entity);
        return merchant.getId();
    }

    /** 确保申请人有一条已通过的商城供应商业务身份。 */
    private IdentityApplicationEntity ensureApprovedIdentity(GrantRequest body, Long merchantId,
                                                             String identityType) {
        List<IdentityApplicationEntity> rows = identityApplicationMapper.selectList(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, body.userId())
                        .eq(IdentityApplicationEntity::getIdentityType, identityType)
                        .orderByDesc(IdentityApplicationEntity::getId));
        IdentityApplicationEntity approved = rows.stream()
                .filter(row -> "approved".equals(row.getStatus()))
                .findFirst().orElse(null);
        if (approved != null) {
            return approved;
        }
        IdentityApplicationEntity pending = rows.stream()
                .filter(row -> "pending".equals(row.getStatus()))
                .findFirst().orElse(null);
        LocalDateTime now = LocalDateTime.now();
        if (pending != null) {
            pending.setStatus("approved");
            pending.setMerchantId(pending.getMerchantId() == null ? merchantId : pending.getMerchantId());
            pending.setReviewerName("供应商入驻审核");
            pending.setReviewTime(now);
            pending.setReviewRemark("供应商入驻审核通过，自动开通业务身份");
            identityApplicationMapper.updateById(pending);
            return pending;
        }

        IdentityApplicationEntity entity = new IdentityApplicationEntity();
        entity.setUserId(body.userId());
        entity.setIdentityType(identityType);
        entity.setMerchantId(merchantId);
        entity.setSubjectName(body.companyName());
        entity.setCreditCode(body.creditCode());
        entity.setContactName(body.contactName());
        entity.setContactPhone(body.contactPhone());
        entity.setApplyNote("供应商入驻审核通过，自动开通");
        entity.setStatus("approved");
        entity.setReviewerName("供应商入驻审核");
        entity.setReviewTime(now);
        entity.setReviewRemark("供应商入驻审核通过，自动开通业务身份");
        entity.setMarketId(body.marketId() == null ? 1L : body.marketId());
        identityApplicationMapper.insert(entity);
        return entity;
    }

    /** 开通入参（字段均来自 S2B2C 已入库的供应商档案，不接受前端直接构造） */
    public record GrantRequest(
            Long userId,
            Long marketId,
            String companyName,
            String creditCode,
            String contactName,
            String contactPhone,
            String identityType) {
    }
}
