package com.agri.produce.internal.admin.foodsafety;

/**
 * 处置食品安全告警 请求体（契约 §2.4）。
 *
 * @param measure 处置措施（页面下拉：封存批次并启动复检 / 通知农场负责人整改 /
 *                下架并召回流通批次 / 转属地监管部门处理 / 要求补传检测报告）
 * @param remark  处置说明（≤200 字）
 */
public record FoodSafetyAlertHandleRequest(String measure, String remark) {
}
