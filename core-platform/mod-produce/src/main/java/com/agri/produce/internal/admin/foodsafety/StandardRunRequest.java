package com.agri.produce.internal.admin.foodsafety;

/**
 * 执行行业标准自动校验 请求体（契约 §4.8）。
 *
 * @param standardNo 标准编号（须与路径参数一致）
 * @param batchScope 批次范围：last7d / last30d / quarter
 */
public record StandardRunRequest(String standardNo, String batchScope) {
}
