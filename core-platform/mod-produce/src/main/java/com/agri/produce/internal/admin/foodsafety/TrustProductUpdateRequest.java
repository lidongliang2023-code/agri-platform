package com.agri.produce.internal.admin.foodsafety;

/**
 * 编辑可信农产品 请求体（契约 §5.3）。
 *
 * @param level      可信等级：diamond / gold / silver / normal
 * @param score      信任分数 0~100 整数
 * @param cert       认证标志：organic / green / pollution-free / none
 * @param certOrg    认证机构（≤50 字）
 * @param validUntil 认证有效期 {@code yyyy-MM-dd}，须不早于今天
 */
public record TrustProductUpdateRequest(String level, Integer score, String cert,
                                        String certOrg, String validUntil) {
}
