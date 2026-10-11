package com.agri.produce.internal.admin.foodsafety;

import java.math.BigDecimal;

/**
 * 超标处罚登记 请求体（契约 §4.2）。
 *
 * @param action 处罚方式（警告并限期整改 / 罚款并暂停供货 / 列入重点监管名单 / 移交执法部门）
 * @param amount 处罚金额（元），须大于 0
 * @param remark 整改要求（≤200 字）
 */
public record InputPunishRequest(String action, BigDecimal amount, String remark) {
}
