package com.agri.produce.internal.admin.foodsafety;

/**
 * 处理流通异常 请求体（契约 §3.2）。
 *
 * @param action 处置方式（页面下拉：通知责任方核查 / 召回问题批次 / 转人工复核 / 关闭）；
 *               {@code 关闭} 会把状态置为 done，其余置为 processing
 * @param remark 处置说明（≤200 字）
 */
public record CirculationHandleRequest(String action, String remark) {
}
