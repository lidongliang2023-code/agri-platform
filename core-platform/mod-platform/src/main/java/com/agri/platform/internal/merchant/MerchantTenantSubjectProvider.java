package com.agri.platform.internal.merchant;

import com.agri.core.infra.tenant.TenantSubjectProvider;
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

    @Override
    public PageResult<TenantSubject> page(long page, long size, String keyword, Integer status, String memberType) {
        LambdaQueryWrapper<MerchantEntity> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(query -> query.like(MerchantEntity::getName, value)
                    .or().like(MerchantEntity::getCode, value)
                    .or().like(MerchantEntity::getContactName, value));
        }
        wrapper.eq(status != null, MerchantEntity::getStatus, status)
                .eq(memberType != null && !memberType.isBlank(),
                        MerchantEntity::getMemberType, normalizeMemberType(memberType))
                .orderByDesc(MerchantEntity::getCreatedAt);
        Page<MerchantEntity> result = merchantMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords().stream().map(this::toSubject).toList(),
                result.getTotal(), page, size);
    }

    @Override
    public List<TenantSubject> listAll() {
        return merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                        .orderByDesc(MerchantEntity::getCreatedAt))
                .stream().map(this::toSubject).toList();
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
        return toSubject(merchant);
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
        return toSubject(merchant);
    }

    private TenantSubject toSubject(MerchantEntity merchant) {
        return new TenantSubject(
                merchant.getId(),
                merchant.getCode(),
                merchant.getName(),
                normalizeMemberType(merchant.getMemberType()),
                merchant.getIndustry(),
                merchant.getBusinessType(),
                merchant.getContactName(),
                merchant.getContactPhone(),
                merchant.getStatus() == null ? 1 : merchant.getStatus(),
                merchant.getVerifyStatus(),
                merchant.getCreatedAt());
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
