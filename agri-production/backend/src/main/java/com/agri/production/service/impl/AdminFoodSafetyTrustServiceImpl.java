package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.FoodSafetyTrustProduct;
import com.agri.production.mapper.FoodSafetyTrustProductMapper;
import com.agri.production.service.IAdminFoodSafetyTrustService;
import com.agri.production.vo.AdminFsTrustProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
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
 * 运营端：可信农产品管理实现（P18）。口径与平台侧 AdminFoodSafetyTrustService 对齐。
 */
@Slf4j
@Service
public class AdminFoodSafetyTrustServiceImpl implements IAdminFoodSafetyTrustService {

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

    private final FoodSafetyTrustProductMapper trustProductMapper;

    public AdminFoodSafetyTrustServiceImpl(FoodSafetyTrustProductMapper trustProductMapper) {
        this.trustProductMapper = trustProductMapper;
    }

    @Override
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", count(null));
        for (String level : LEVELS) {
            result.put(level, count(level));
        }
        result.put("pending", trustProductMapper.selectCount(
                new LambdaQueryWrapper<FoodSafetyTrustProduct>()
                        .eq(FoodSafetyTrustProduct::getAuditStatus, AUDIT_PENDING)));
        return result;
    }

    private Long count(String level) {
        LambdaQueryWrapper<FoodSafetyTrustProduct> w = new LambdaQueryWrapper<>();
        if (level != null) {
            w.eq(FoodSafetyTrustProduct::getTrustLevel, level);
        }
        Long hits = trustProductMapper.selectCount(w);
        return hits == null ? 0L : hits;
    }

    @Override
    public PageResult<AdminFsTrustProductVO> pageProducts(int pageNum, int pageSize, String level, String auditStatus,
                                                          String name, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FoodSafetyTrustProduct> w = new LambdaQueryWrapper<>();
        if (isEffective(level)) {
            w.eq(FoodSafetyTrustProduct::getTrustLevel, level.trim().toLowerCase());
        }
        if (isEffective(auditStatus)) {
            w.eq(FoodSafetyTrustProduct::getAuditStatus, auditStatus.trim().toLowerCase());
        }
        if (isEffective(name)) {
            w.like(FoodSafetyTrustProduct::getProductName, name.trim());
        }
        if (isEffective(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(FoodSafetyTrustProduct::getProducer, kw)
                    .or().like(FoodSafetyTrustProduct::getProductId, kw));
        }
        // 信任分倒序是页面口径（高分在前）；再按编号定序，避免同分时分页串行
        w.orderByDesc(FoodSafetyTrustProduct::getTrustScore)
                .orderByAsc(FoodSafetyTrustProduct::getProductId);
        Page<FoodSafetyTrustProduct> page = trustProductMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsTrustProductVO> rows = page.getRecords().stream()
                .map(AdminFsTrustProductVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsTrustProductVO updateProduct(String productId, String level, Integer score, String cert,
                                               String validUntil, String certOrg) {
        if (!isEffective(level) || !LEVELS.contains(level.trim().toLowerCase())) {
            throw new BusinessException(400, "可信等级应为 diamond / gold / silver / normal");
        }
        if (score == null || score < 0 || score > SCORE_MAX) {
            throw new BusinessException(400, "信任分数应为 0~" + SCORE_MAX + " 的整数");
        }
        if (!isEffective(cert) || !CERTS.contains(cert.trim().toLowerCase())) {
            throw new BusinessException(400, "认证标志应为 organic / green / pollution-free / none");
        }
        String certMark = cert.trim().toLowerCase();
        boolean needCert = !CERT_NONE.equals(certMark);
        String org = trimToNull(certOrg);
        if (needCert && org == null) {
            throw new BusinessException(400, "认证机构为必填（认证标志非 none 时）");
        }
        if (org != null && org.length() > CERT_ORG_MAX_LENGTH) {
            throw new BusinessException(400, "认证机构不得超过 " + CERT_ORG_MAX_LENGTH + " 字");
        }
        LocalDate valid = null;
        String validText = trimToNull(validUntil);
        if (validText != null) {
            valid = parseDate(validText, "认证有效期");
            // 有效期是"声明出来的未来承诺"，填一个已经过去的日期等于让页面显示一张过期证书
            if (valid.isBefore(LocalDate.now())) {
                throw new BusinessException(400, "认证有效期不得早于今天");
            }
        } else if (needCert) {
            throw new BusinessException(400, "认证有效期为必填（认证标志非 none 时）");
        }

        FoodSafetyTrustProduct product = requireProduct(productId);
        product.setTrustLevel(level.trim().toLowerCase());
        product.setTrustScore(score);
        product.setCertMark(certMark);
        product.setCertOrg(org);
        product.setValidUntil(valid);
        product.setUpdateTime(LocalDateTime.now());
        trustProductMapper.updateById(product);
        log.info("可信农产品编辑：{} → 等级 {} / 信任分 {} / 认证 {}", product.getProductId(),
                product.getTrustLevel(), score, certMark);
        return AdminFsTrustProductVO.of(trustProductMapper.selectById(product.getProductId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsTrustProductVO auditProduct(String productId, String action, String remark) {
        if (!isEffective(action)
                || !(ACTION_APPROVE.equals(action.trim()) || ACTION_REJECT.equals(action.trim()))) {
            throw new BusinessException(400, "审核动作应为 approve / reject");
        }
        String text = trimToNull(remark);
        if (text == null) {
            throw new BusinessException(400, "审核意见为必填");
        }
        if (text.length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(400, "审核意见不得超过 " + REMARK_MAX_LENGTH + " 字");
        }
        FoodSafetyTrustProduct product = requireProduct(productId);
        boolean approve = ACTION_APPROVE.equals(action.trim());
        product.setAuditStatus(approve ? AUDIT_APPROVED : AUDIT_REJECTED);
        product.setAuditRemark(text);
        product.setAuditTime(LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());
        trustProductMapper.updateById(product);
        log.info("可信农产品审核：{} → {}（{}）", product.getProductId(), product.getAuditStatus(), text);
        return AdminFsTrustProductVO.of(trustProductMapper.selectById(product.getProductId()));
    }

    private FoodSafetyTrustProduct requireProduct(String productId) {
        if (!isEffective(productId)) {
            throw new BusinessException(400, "缺少产品编号");
        }
        FoodSafetyTrustProduct product = trustProductMapper.selectById(productId.trim());
        if (product == null) {
            throw new BusinessException(404, "可信农产品不存在：" + productId.trim());
        }
        return product;
    }

    /** 解析 yyyy-MM-dd；非法格式直接报参数错误（不静默当空值，否则"填错了"会变成"证书被清空"）。 */
    private LocalDate parseDate(String text, String field) {
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + "格式应为 yyyy-MM-dd：" + text);
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
