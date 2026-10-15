package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminFsTrustProductVO;

import java.util.Map;

/**
 * 运营端：可信农产品管理（P18）。
 *
 * <p>端点前缀 {@code /api/v1/production/admin/food-safety/trust-label}。表与演示数据来自
 * schema-patch-food-safety.sql / schema-patch-food-safety-data-trust.sql。</p>
 *
 * <p>与同域其它子域同口径：不做租户过滤、运营端可写全量（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminFoodSafetyTrustService {

    /**
     * 可信农产品统计。
     *
     * <p>全部字段由本表实时聚合，不使用原型示例口径：{@code total} 总数、四个等级计数、
     * {@code pending} 待审核数。没有数据时给 0（0 是"确实一条都没有"的真值），不回落示例数据。</p>
     */
    Map<String, Object> stats();

    /** 可信农产品名单分页（level / auditStatus / name / keyword 均可选；keyword 匹配生产者与产品编号）。 */
    PageResult<AdminFsTrustProductVO> pageProducts(int pageNum, int pageSize, String level, String auditStatus,
                                                  String name, String keyword);

    /**
     * 编辑可信农产品（等级 / 信任分 / 认证标志 / 认证机构 / 有效期）。
     *
     * <p>认证标志为 {@code none} 时认证机构与有效期无业务含义，允许留空并落 NULL；
     * 其它标志下两者必填 —— 不做无意义的必填，也不放过真正需要的必填。</p>
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 产品不存在（404）
     */
    AdminFsTrustProductVO updateProduct(String productId, String level, Integer score, String cert,
                                        String validUntil, String certOrg);

    /**
     * 审核可信农产品（approve / reject），落审核状态、意见与时间。
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 产品不存在（404）
     */
    AdminFsTrustProductVO auditProduct(String productId, String action, String remark);
}
