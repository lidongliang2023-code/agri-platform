package com.agri.produce.internal.admin.foodsafety;

/**
 * 冷链资源立即撮合 请求体（契约 §6.4）。
 *
 * @param resourceId  资源编号
 * @param demander    需求方
 * @param cargo       货物 / 用途（≤50 字）
 * @param startTime   预约开始时间 {@code yyyy-MM-dd}，须不早于今天
 * @param tempRequire 温区要求（≤30 字）
 * @param remark      备注（≤200 字，可选）
 */
public record MatchCreateRequest(String resourceId, String demander, String cargo,
                                 String startTime, String tempRequire, String remark) {
}
