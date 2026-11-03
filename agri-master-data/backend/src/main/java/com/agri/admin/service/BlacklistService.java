package com.agri.admin.service;

import com.agri.admin.controller.BlacklistController;
import com.agri.common.constant.ErrorCode;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.BlacklistRecord;
import com.agri.masterdata.mapper.BlacklistMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/** 黑名单：平台级联合惩戒的登记与解除。 */
@Service
@RequiredArgsConstructor
public class BlacklistService {

    private static final Set<String> TARGET_TYPES = Set.of("user", "customer", "supplier");
    private static final String ACTIVE = "active";
    private static final String RELEASED = "released";

    private final BlacklistMapper blacklistMapper;

    public PageResult<BlacklistRecord> page(Integer pageNum, Integer pageSize, String targetType,
                                            String status, String keyword) {
        LambdaQueryWrapper<BlacklistRecord> wrapper = new LambdaQueryWrapper<BlacklistRecord>()
                .eq(hasText(targetType), BlacklistRecord::getTargetType, targetType)
                .eq(hasText(status), BlacklistRecord::getStatus, status)
                .and(hasText(keyword), w -> w.like(BlacklistRecord::getTargetName, keyword)
                        .or().like(BlacklistRecord::getTargetId, keyword)
                        .or().like(BlacklistRecord::getReason, keyword))
                .orderByDesc(BlacklistRecord::getId);
        Page<BlacklistRecord> page = blacklistMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return PageResult.success(page.getRecords(), page.getTotal(), pageNum, pageSize);
    }

    @Transactional
    public Long create(BlacklistController.BlacklistRequest request) {
        if (!TARGET_TYPES.contains(request.targetType())) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR, "对象类型只能是 user / customer / supplier");
        }
        String targetName = trim(request.targetName());
        if (targetName == null) {
            throw new BusinessException(ErrorCode.PARAM_NOT_NULL, "对象名称不能为空");
        }
        String reason = trim(request.reason());
        if (reason == null) {
            throw new BusinessException(ErrorCode.PARAM_NOT_NULL, "拉黑原因不能为空");
        }
        String targetId = trim(request.targetId());
        if (targetId != null) {
            long exists = blacklistMapper.selectCount(new LambdaQueryWrapper<BlacklistRecord>()
                    .eq(BlacklistRecord::getTargetType, request.targetType())
                    .eq(BlacklistRecord::getTargetId, targetId)
                    .eq(BlacklistRecord::getStatus, ACTIVE));
            if (exists > 0) {
                throw new BusinessException(ErrorCode.DATA_DUPLICATE, "该对象已在生效中的黑名单里");
            }
        }
        BlacklistRecord record = new BlacklistRecord();
        record.setTargetType(request.targetType());
        record.setTargetId(targetId);
        record.setTargetName(targetName);
        record.setReason(reason);
        record.setEvidence(trim(request.evidence()));
        record.setStartTime(request.startTime() == null ? LocalDateTime.now() : request.startTime());
        record.setExpireTime(request.expireTime());
        record.setStatus(ACTIVE);
        blacklistMapper.insert(record);
        return record.getId();
    }

    @Transactional
    public void release(Long id, String reason) {
        BlacklistRecord record = blacklistMapper.selectById(id);
        if (record == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "黑名单记录不存在");
        }
        if (!ACTIVE.equals(record.getStatus())) {
            throw new BusinessException(ErrorCode.OPERATION_FAILED, "该记录已解除，无需重复操作");
        }
        record.setStatus(RELEASED);
        record.setReleaseReason(trim(reason));
        record.setReleaseTime(LocalDateTime.now());
        record.setUpdateBy(SecurityUtils.getUsername());
        blacklistMapper.updateById(record);
    }

    /** 供其它模块校验用：某对象是否处于生效中的黑名单（到期自动视为失效）。 */
    public boolean isActive(String targetType, String targetId) {
        List<BlacklistRecord> rows = blacklistMapper.selectList(new LambdaQueryWrapper<BlacklistRecord>()
                .eq(BlacklistRecord::getTargetType, targetType)
                .eq(BlacklistRecord::getTargetId, targetId)
                .eq(BlacklistRecord::getStatus, ACTIVE));
        LocalDateTime now = LocalDateTime.now();
        return rows.stream().anyMatch((row) -> row.getExpireTime() == null || row.getExpireTime().isAfter(now));
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String trim(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
