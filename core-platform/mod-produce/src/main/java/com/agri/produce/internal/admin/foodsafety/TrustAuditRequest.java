package com.agri.produce.internal.admin.foodsafety;

/**
 * 可信农产品审核 请求体（契约 §5.4）。
 *
 * @param action 审核动作：approve / reject
 * @param remark 审核意见（≤200 字）
 */
public record TrustAuditRequest(String action, String remark) {
}
