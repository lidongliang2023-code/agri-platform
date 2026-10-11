package com.agri.produce.internal.admin.foodsafety;

/**
 * 下发标签整改通知 请求体（契约 §4.4）。
 *
 * @param deadline 整改期限描述/日期，如 {@code 2026-11-20 前完成标签改版并提交复审}
 * @param remark   整改要求（≤200 字）
 */
public record LabelRectifyRequest(String deadline, String remark) {
}
