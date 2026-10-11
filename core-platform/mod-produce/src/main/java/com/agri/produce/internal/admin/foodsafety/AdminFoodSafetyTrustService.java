package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 运营端：可信农产品管理（P18）。
 *
 * <p>统计口径（全部由 {@code prod_fs_trust_product} 实时聚合）：total 为产品总数，
 * diamond/gold/silver/normal 按可信等级计数，pending 为审核状态待审的数量。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFoodSafetyTrustService {

    private static final String FILTER_ALL = "all";
    private static final String AUDIT_PENDING = "pending";
    private static final String AUDIT_APPROVED = "approved";
    private static final String AUDIT_REJECTED = "rejected";
    private static final String ACTION_APPROVE = "approve";
    private static final String ACTION_REJECT = "reject";
    private static final String CERT_NONE = "none";
    private static final int SCORE_MAX = 100;
    private static final int CERT_ORG_MAX_LENGTH = 50;
    private static final int REMARK_MAX_LENGTH = 200;
    private static final List<String> LEVELS = List.of("diamond", "gold", "silver", "normal");
    private static final Set<String> CERTS = Set.of("organic", "green", "pollution-free", CERT_NONE);

    private final TrustProductMapper trustProductMapper;

    /**
     * 可信农产品统计。
     *
     * @return total / diamond / gold / silver / normal / pending
     */
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", trustProductMapper.selectCount(null));
        for (String level : LEVELS) {
            result.put(level, trustProductMapper.selectCount(
                    new LambdaQueryWrapper<TrustProductEntity>().eq(TrustProductEntity::getLevel, level)));
        }
        result.put("pending", trustProductMapper.selectCount(
                new LambdaQueryWrapper<TrustProductEntity>().eq(TrustProductEntity::getAuditStatus, AUDIT_PENDING)));
        return result;
    }

    /**
     * 可信农产品名单分页。
     *
     * @param page        页码
     * @param size        每页条数
     * @param level       可信等级筛选（all/空 = 不筛选）
     * @param auditStatus 审核状态筛选（all/空 = 不筛选）
     * @param name        产品名称模糊匹配
     * @param keyword     关键字：模糊匹配生产者 / 产品编号
     * @return 分页结果
     */
    public PageResult<TrustProductEntity> pageProducts(long page, long size, String level,
                                                       String auditStatus, String name, String keyword) {
        Page<TrustProductEntity> resultPage = trustProductMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TrustProductEntity>()
                        .eq(isEffective(level), TrustProductEntity::getLevel, level)
                        .eq(isEffective(auditStatus), TrustProductEntity::getAuditStatus, auditStatus)
                        .like(isEffective(name), TrustProductEntity::getName, name)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(TrustProductEntity::getProducer, keyword)
                                .or().like(TrustProductEntity::getId, keyword))
                        .orderByDesc(TrustProductEntity::getScore));
        return PageResult.of(resultPage.getRecords(), resultPage.getTotal(), page, size);
    }

    /**
     * 编辑可信农产品（写操作）。
     *
     * <p>认证标志为 none 时，认证机构与有效期无业务含义，允许留空并落 NULL；
     * 其余认证标志下两者必填 —— 不做无意义的必填，也不放过真正需要的必填。</p>
     *
     * @param id      产品编号
     * @param request 编辑请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean update(String id, TrustProductUpdateRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        if (!LEVELS.contains(request.level())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "可信等级应为 diamond / gold / silver / normal");
        }
        if (request.score() == null || request.score() < 0 || request.score() > SCORE_MAX) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "信任分数应为 0~100 的整数");
        }
        if (request.cert() == null || !CERTS.contains(request.cert())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "认证标志应为 organic / green / pollution-free / none");
        }
        boolean needCertOrg = !CERT_NONE.equals(request.cert());
        String certOrg = trimToNull(request.certOrg());
        if (needCertOrg && certOrg == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "认证机构为必填（认证标志非 none 时）");
        }
        if (certOrg != null && certOrg.length() > CERT_ORG_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "认证机构不得超过 50 字");
        }
        LocalDate validUntil = null;
        String validUntilText = trimToNull(request.validUntil());
        if (validUntilText != null) {
            validUntil = parseDate(validUntilText, "认证有效期");
            if (validUntil.isBefore(LocalDate.now())) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "认证有效期不得早于今天");
            }
        } else if (needCertOrg) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "认证有效期为必填（认证标志非 none 时）");
        }
        TrustProductEntity product = trustProductMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "可信农产品不存在：" + id);
        }
        product.setLevel(request.level());
        product.setScore(request.score());
        product.setCert(request.cert());
        product.setCertOrg(certOrg);
        product.setValidUntil(validUntil);
        return trustProductMapper.updateById(product) > 0;
    }

    /**
     * 可信农产品审核（写操作）。
     *
     * @param id      产品编号
     * @param request 审核请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean audit(String id, TrustAuditRequest request) {
        if (request == null || request.action() == null
                || !(ACTION_APPROVE.equals(request.action()) || ACTION_REJECT.equals(request.action()))) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "审核动作应为 approve / reject");
        }
        String remark = trimToNull(request.remark());
        if (remark == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "审核意见为必填");
        }
        if (remark.length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "审核意见不得超过 200 字");
        }
        TrustProductEntity product = trustProductMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "可信农产品不存在：" + id);
        }
        product.setAuditStatus(ACTION_APPROVE.equals(request.action()) ? AUDIT_APPROVED : AUDIT_REJECTED);
        product.setAuditRemark(remark);
        product.setAuditTime(LocalDateTime.now());
        return trustProductMapper.updateById(product) > 0;
    }

    /** 解析 yyyy-MM-dd；非法格式直接报参数错误（不静默当空值）。 */
    private LocalDate parseDate(String text, String field) {
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException ex) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "格式应为 yyyy-MM-dd：" + text);
        }
    }

    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
