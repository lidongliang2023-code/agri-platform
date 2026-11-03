package com.agri.platform.internal.merchant;

import com.agri.core.infra.tenant.TenantSubjectProvider;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 以经营主体表作为唯一租户主档。
 */
@Service
@RequiredArgsConstructor
public class MerchantTenantSubjectProvider implements TenantSubjectProvider {

    private final MerchantMapper merchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final UserIdentityMapper identityMapper;

    @Override
    public PageResult<TenantSubject> page(long page, long size, String keyword, Integer status, String memberType) {
        LambdaQueryWrapper<MerchantEntity> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(query -> query.like(MerchantEntity::getName, value)
                    .or().like(MerchantEntity::getCode, value)
                    .or().like(MerchantEntity::getCreditCode, value)
                    .or().like(MerchantEntity::getContactName, value)
                    .or().like(MerchantEntity::getContactPhone, value));
        }
        wrapper.eq(status != null, MerchantEntity::getStatus, status)
                .eq(memberType != null && !memberType.isBlank(),
                        MerchantEntity::getMemberType, normalizeMemberType(memberType))
                .orderByDesc(MerchantEntity::getCreatedAt);
        Page<MerchantEntity> result = merchantMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(toDetailedSubjects(result.getRecords()),
                result.getTotal(), page, size);
    }

    @Override
    public List<TenantSubject> listAll() {
        return toDetailedSubjects(merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                .orderByDesc(MerchantEntity::getCreatedAt)));
    }

    @Override
    public TenantSubject findById(Long tenantId) {
        if (tenantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "租户 ID 不能为空");
        }
        MerchantEntity merchant = merchantMapper.selectById(tenantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体租户不存在");
        }
        return toDetailedSubject(merchant);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TenantSubject update(Long tenantId, TenantSubjectUpdate update) {
        if (update == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "租户资料不能为空");
        }
        MerchantEntity merchant = merchantMapper.selectById(tenantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体租户不存在");
        }
        if (update.tenantName() != null) {
            String name = update.tenantName().trim();
            if (name.isEmpty()) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "租户名称不能为空");
            }
            merchant.setName(name);
        }
        if (update.industry() != null) {
            merchant.setIndustry(trimToNull(update.industry()));
        }
        if (update.businessType() != null) {
            merchant.setBusinessType(trimToNull(update.businessType()));
        }
        if (update.companySize() != null) {
            merchant.setCompanySize(trimToNull(update.companySize()));
        }
        if (update.address() != null) {
            merchant.setAddress(trimToNull(update.address()));
        }
        if (update.creditCode() != null) {
            String creditCode = trimToNull(update.creditCode());
            if (creditCode != null && !creditCode.matches("[0-9A-Za-z]{15,18}")) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "统一社会信用代码应为 15-18 位字母数字");
            }
            Long duplicate = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>()
                    .eq(MerchantEntity::getCreditCode, creditCode)
                    .ne(MerchantEntity::getId, merchant.getId()));
            if (duplicate != null && duplicate > 0) {
                throw new BusinessException(ErrorCode.CONFLICT, "该统一社会信用代码已登记");
            }
            merchant.setCreditCode(creditCode);
        }
        if (update.contactName() != null) {
            merchant.setContactName(trimToNull(update.contactName()));
        }
        if (update.contactPhone() != null) {
            merchant.setContactPhone(trimToNull(update.contactPhone()));
        }
        if (update.status() != null) {
            if (update.status() != 0 && update.status() != 1) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "租户状态只能是 0（停用）或 1（启用）");
            }
            merchant.setStatus(update.status());
        }
        merchantMapper.updateById(merchant);
        return toDetailedSubject(merchant);
    }

    private TenantSubject toSubject(MerchantEntity merchant) {
        return new TenantSubject(
                merchant.getId(),
                merchant.getCode(),
                merchant.getName(),
                normalizeMemberType(merchant.getMemberType()),
                merchant.getIndustry(),
                merchant.getCompanySize(),
                merchant.getBusinessType(),
                merchant.getAddress(),
                merchant.getCreditCode(),
                merchant.getContactName(),
                merchant.getContactPhone(),
                merchant.getStatus() == null ? 1 : merchant.getStatus(),
                merchant.getVerifyStatus(),
                merchant.getVerifyRemark(),
                merchant.getCreatedAt(),
                null,
                null);
    }

    private TenantSubject toDetailedSubject(MerchantEntity merchant) {
        MerchantCertificationEntity certification = "personal".equalsIgnoreCase(merchant.getMemberType())
                ? null : latestCertification(merchant.getId());
        UserIdentityEntity identity = "personal".equalsIgnoreCase(merchant.getMemberType())
                ? latestIdentity(merchant.getId()) : null;
        TenantSubject base = toSubject(merchant);
        return new TenantSubject(
                base.tenantId(), base.tenantCode(), base.tenantName(), base.memberType(),
                base.industry(), base.companySize(), base.businessType(), base.address(),
                base.creditCode(), base.contactName(), base.contactPhone(), base.status(),
                base.verifyStatus(), base.verifyRemark(), base.createdAt(),
                certification == null ? null : new CertificationInfo(
                        certification.getCertNo(), certification.getCompanyName(),
                        certification.getCreditCode(), certification.getLegalPerson(),
                        certification.getLicenseNo(), certification.getContactName(),
                        certification.getContactPhone(), certification.getAttachNote(),
                        certification.getBusinessLicenseUrl(), certification.getLegalPersonFaceStatus(),
                        certification.getCorporateBankName(), certification.getCorporateBankAccount(),
                        certification.getCorporateTransferStatus(), certification.getRegisteredCapital(),
                        certification.getVerificationChannel(), certification.getCertStatus(),
                        certification.getSubmitTime(), certification.getReviewRemark()),
                identity == null ? null : new IdentityInfo(
                        identity.getIdentityNo(), identity.getRealName(), identity.getIdNoMasked(),
                        identity.getValidStart(), identity.getValidEnd(), identity.getContactPhone(),
                        identity.getAddress(), identity.getEmail(), identity.getBusinessType(),
                        identity.getVerificationChannel(), identity.getPoliceVerified(),
                        identity.getLivenessVerified(), identity.getStatus(), identity.getSubmitTime(),
                        identity.getReviewRemark()));
    }

    /**
     * 列表批量补齐认证和实名资料，避免每个主体分别查询认证、成员绑定和实名记录。
     */
    private List<TenantSubject> toDetailedSubjects(List<MerchantEntity> merchants) {
        if (merchants.isEmpty()) {
            return List.of();
        }
        List<Long> merchantIds = merchants.stream().map(MerchantEntity::getId).toList();
        List<MerchantCertificationEntity> certifications = certificationMapper.selectList(
                new LambdaQueryWrapper<MerchantCertificationEntity>()
                        .in(MerchantCertificationEntity::getMerchantId, merchantIds)
                        .orderByDesc(MerchantCertificationEntity::getSubmitTime)
                        .orderByDesc(MerchantCertificationEntity::getId));
        java.util.Map<Long, MerchantCertificationEntity> latestCertifications = new java.util.HashMap<>();
        for (MerchantCertificationEntity certification : certifications) {
            latestCertifications.putIfAbsent(certification.getMerchantId(), certification);
        }

        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .in(UserMerchantEntity::getMerchantId, merchantIds)
                        .eq(UserMerchantEntity::getStatus, 1)
                        .orderByAsc(UserMerchantEntity::getId));
        java.util.Map<Long, Long> ownerIds = new java.util.HashMap<>();
        for (UserMerchantEntity binding : bindings) {
            if ("owner".equalsIgnoreCase(binding.getRoleInMerchant())) {
                ownerIds.putIfAbsent(binding.getMerchantId(), binding.getUserId());
            }
        }
        for (UserMerchantEntity binding : bindings) {
            ownerIds.putIfAbsent(binding.getMerchantId(), binding.getUserId());
        }

        List<Long> userIds = ownerIds.values().stream().distinct().toList();
        java.util.Map<Long, UserIdentityEntity> latestIdentities = new java.util.HashMap<>();
        if (!userIds.isEmpty()) {
            List<UserIdentityEntity> identities = identityMapper.selectList(
                    new LambdaQueryWrapper<UserIdentityEntity>()
                            .in(UserIdentityEntity::getUserId, userIds)
                            .orderByDesc(UserIdentityEntity::getSubmitTime)
                            .orderByDesc(UserIdentityEntity::getId));
            for (UserIdentityEntity identity : identities) {
                latestIdentities.putIfAbsent(identity.getUserId(), identity);
            }
        }

        return merchants.stream().map(merchant -> {
            boolean personal = "personal".equalsIgnoreCase(merchant.getMemberType());
            MerchantCertificationEntity certification = personal
                    ? null : latestCertifications.get(merchant.getId());
            Long ownerId = ownerIds.get(merchant.getId());
            UserIdentityEntity identity = personal && ownerId != null
                    ? latestIdentities.get(ownerId) : null;
            return toDetailedSubject(merchant, certification, identity);
        }).toList();
    }

    private TenantSubject toDetailedSubject(MerchantEntity merchant,
                                            MerchantCertificationEntity certification,
                                            UserIdentityEntity identity) {
        TenantSubject base = toSubject(merchant);
        return new TenantSubject(
                base.tenantId(), base.tenantCode(), base.tenantName(), base.memberType(),
                base.industry(), base.companySize(), base.businessType(), base.address(),
                base.creditCode(), base.contactName(), base.contactPhone(), base.status(),
                base.verifyStatus(), base.verifyRemark(), base.createdAt(),
                certification == null ? null : new CertificationInfo(
                        certification.getCertNo(), certification.getCompanyName(),
                        certification.getCreditCode(), certification.getLegalPerson(),
                        certification.getLicenseNo(), certification.getContactName(),
                        certification.getContactPhone(), certification.getAttachNote(),
                        certification.getBusinessLicenseUrl(), certification.getLegalPersonFaceStatus(),
                        certification.getCorporateBankName(), certification.getCorporateBankAccount(),
                        certification.getCorporateTransferStatus(), certification.getRegisteredCapital(),
                        certification.getVerificationChannel(), certification.getCertStatus(),
                        certification.getSubmitTime(), certification.getReviewRemark()),
                identity == null ? null : new IdentityInfo(
                        identity.getIdentityNo(), identity.getRealName(), identity.getIdNoMasked(),
                        identity.getValidStart(), identity.getValidEnd(), identity.getContactPhone(),
                        identity.getAddress(), identity.getEmail(), identity.getBusinessType(),
                        identity.getVerificationChannel(), identity.getPoliceVerified(),
                        identity.getLivenessVerified(), identity.getStatus(), identity.getSubmitTime(),
                        identity.getReviewRemark()));
    }

    private MerchantCertificationEntity latestCertification(Long merchantId) {
        return certificationMapper.selectOne(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                .orderByDesc(MerchantCertificationEntity::getSubmitTime)
                .orderByDesc(MerchantCertificationEntity::getId)
                .last("LIMIT 1"));
    }

    private UserIdentityEntity latestIdentity(Long merchantId) {
        UserMerchantEntity owner = userMerchantMapper.selectOne(new LambdaQueryWrapper<UserMerchantEntity>()
                .eq(UserMerchantEntity::getMerchantId, merchantId)
                .eq(UserMerchantEntity::getRoleInMerchant, "owner")
                .eq(UserMerchantEntity::getStatus, 1)
                .orderByAsc(UserMerchantEntity::getId)
                .last("LIMIT 1"));
        if (owner == null) {
            owner = userMerchantMapper.selectOne(new LambdaQueryWrapper<UserMerchantEntity>()
                    .eq(UserMerchantEntity::getMerchantId, merchantId)
                    .eq(UserMerchantEntity::getStatus, 1)
                    .orderByAsc(UserMerchantEntity::getId)
                    .last("LIMIT 1"));
        }
        if (owner == null) {
            return null;
        }
        return identityMapper.selectOne(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getUserId, owner.getUserId())
                .orderByDesc(UserIdentityEntity::getSubmitTime)
                .orderByDesc(UserIdentityEntity::getId)
                .last("LIMIT 1"));
    }

    private static String normalizeMemberType(String value) {
        return "personal".equalsIgnoreCase(value) ? "personal" : "enterprise";
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
