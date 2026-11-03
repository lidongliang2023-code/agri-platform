package com.agri.platform.internal.account;

import com.agri.platform.api.facade.CapabilityCodes;
import com.agri.platform.api.facade.CapabilityFacade;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 业务能力解析。
 *
 * <p>能力来源有两条，都必须是**服务端真实数据**：</p>
 * <ul>
 *   <li>业务身份：已审核通过的 {@code platform_identity_application}（批发商/零售商/…）</li>
 *   <li>主体数据：已加入经营主体 → {@code production.manage}；经营主体认证通过 → {@code finance.apply}</li>
 * </ul>
 *
 * <p>只读、无缓存：身份与认证状态随时会变，缓存失效策略的成本高于一次索引查询。</p>
 */
@Service
@RequiredArgsConstructor
public class CapabilityFacadeImpl implements CapabilityFacade {

    private final IdentityApplicationMapper identityApplicationMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantCertificationMapper certificationMapper;

    @Override
    public List<String> codesOf(Long userId) {
        if (userId == null) {
            return List.of();
        }
        Set<String> codes = new LinkedHashSet<>(identityCodes(userId));
        List<Long> merchantIds = merchantIdsOf(userId);
        if (!merchantIds.isEmpty()) {
            codes.add(CapabilityCodes.PRODUCTION_MANAGE);
        }
        if (hasApprovedCertification(merchantIds)) {
            codes.add(CapabilityCodes.FINANCE_APPLY);
        }
        // 商城消费：登录即具备（商城侧还会要求已建消费者档案）
        codes.add(CapabilityCodes.S2B2C_CONSUMER);
        if (isMallSupplier(userId, merchantIds)) {
            codes.add(CapabilityCodes.S2B2C_SUPPLIER);
        }
        return List.copyOf(codes);
    }

    @Override
    public Decision check(Long userId, String capabilityCode, Long merchantId) {
        if (userId == null) {
            return new Decision(false, "请先登录");
        }
        BusinessCapabilities.Definition definition = BusinessCapabilities.byCode(capabilityCode);
        if (definition == null) {
            return new Decision(false, "未知能力码：" + capabilityCode);
        }
        // 1) 身份类能力
        if (!definition.identityCode().isEmpty()) {
            boolean granted = identityTypes(userId).contains(definition.identityCode());
            return new Decision(granted, granted ? null
                    : "需要开通「" + definition.identityLabel() + "」业务身份并通过审核");
        }
        // 2) 主体类能力
        List<Long> merchantIds = merchantIdsOf(userId);
        if (CapabilityCodes.PRODUCTION_MANAGE.equals(capabilityCode)) {
            if (merchantId != null && !merchantIds.contains(merchantId)) {
                return new Decision(false, "你不是该主体的成员，不能维护它的生产数据");
            }
            boolean granted = merchantId != null ? merchantIds.contains(merchantId) : !merchantIds.isEmpty();
            return new Decision(granted, granted ? null : "需要先加入经营主体（生产数据按主体归属）");
        }
        if (CapabilityCodes.FINANCE_APPLY.equals(capabilityCode)) {
            if (merchantId != null && !merchantIds.contains(merchantId)) {
                return new Decision(false, "你不是该主体的成员，不能以它申请融资");
            }
            List<Long> scope = merchantId != null ? List.of(merchantId) : merchantIds;
            boolean granted = hasApprovedCertification(scope);
            return new Decision(granted, granted ? null : "需要经营主体认证通过后才能申请融资");
        }
        if (CapabilityCodes.S2B2C_CONSUMER.equals(capabilityCode)) {
            // 消费者能力不依赖主体/认证，登录即可；商城侧再按消费者档案收敛数据范围
            return new Decision(true, null);
        }
        if (CapabilityCodes.S2B2C_SUPPLIER.equals(capabilityCode)) {
            if (merchantId != null && !merchantIds.contains(merchantId)) {
                return new Decision(false, "你不是该主体的成员，不能以它作为商城供应商");
            }
            if (merchantIds.isEmpty()) {
                return new Decision(false, "需要先加入经营主体");
            }
            return new Decision(isMallSupplier(userId, merchantIds), isMallSupplier(userId, merchantIds)
                    ? null : "需要已开通交易类业务身份（批发商 / 零售商 / 农户 / 合作社管理员）");
        }
        return new Decision(false, "该能力暂不支持校验");
    }

    @Override
    public boolean hasAny(Long userId, Collection<String> capabilityCodes) {
        if (userId == null || capabilityCodes == null || capabilityCodes.isEmpty()) {
            return false;
        }
        return codesOf(userId).stream().anyMatch(capabilityCodes::contains);
    }

    @Override
    public void requireAny(Long userId, Collection<String> capabilityCodes, String actionLabel) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "请先登录后再" + actionLabel);
        }
        if (hasAny(userId, capabilityCodes)) {
            return;
        }
        String needed = (capabilityCodes == null ? List.<String>of() : capabilityCodes).stream()
                .map(BusinessCapabilities::byCode)
                .filter(Objects::nonNull)
                .map(definition -> "「" + definition.identityLabel() + "」")
                .distinct()
                .collect(Collectors.joining(" / "));
        throw new BusinessException(ErrorCode.FORBIDDEN,
                "当前账号尚未开通所需业务身份，无法" + actionLabel
                        + "。请先在用户中心「我的组织 → 业务身份」申请" + needed + "，审核通过后自动生效。");
    }

    // ==================== 内部查询 ====================

    /** 商城供应商 = 有主体 + 有交易类业务身份 */
    private boolean isMallSupplier(Long userId, List<Long> merchantIds) {
        if (merchantIds == null || merchantIds.isEmpty()) {
            return false;
        }
        Set<String> types = identityTypes(userId);
        return types.contains("wholesaler") || types.contains("retailer")
                || types.contains("farmer") || types.contains("coop_admin");
    }

    private List<String> identityCodes(Long userId) {
        return identityTypes(userId).stream()
                .map(BusinessCapabilities::ofIdentity)
                .filter(Objects::nonNull)
                .map(BusinessCapabilities.Definition::code)
                .distinct()
                .toList();
    }

    private Set<String> identityTypes(Long userId) {
        return identityApplicationMapper.selectList(new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, userId)
                        .eq(IdentityApplicationEntity::getStatus, "approved"))
                .stream()
                .map(IdentityApplicationEntity::getIdentityType)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private List<Long> merchantIdsOf(Long userId) {
        return userMerchantMapper.selectList(new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1))
                .stream()
                .map(UserMerchantEntity::getMerchantId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private boolean hasApprovedCertification(List<Long> merchantIds) {
        if (merchantIds == null || merchantIds.isEmpty()) {
            return false;
        }
        Long count = certificationMapper.selectCount(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .in(MerchantCertificationEntity::getMerchantId, merchantIds)
                .eq(MerchantCertificationEntity::getCertStatus, "approved"));
        return count != null && count > 0;
    }
}
