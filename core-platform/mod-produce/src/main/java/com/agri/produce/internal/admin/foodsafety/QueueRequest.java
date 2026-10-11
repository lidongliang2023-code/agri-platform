package com.agri.produce.internal.admin.foodsafety;

/**
 * 繁忙资源加入撮合队列 请求体（契约 §6.5）。
 *
 * @param resourceId 资源编号（仅繁忙资源可入队）
 * @param demander   需求方
 * @param expectTime 期望使用时间 {@code yyyy-MM-dd}，须不早于今天
 * @param remark     备注（≤200 字，可选）
 */
public record QueueRequest(String resourceId, String demander, String expectTime, String remark) {
}
