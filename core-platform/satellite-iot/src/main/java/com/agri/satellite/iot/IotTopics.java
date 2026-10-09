package com.agri.satellite.iot;

/**
 * 跨部署单元事件契约（与核心单体 mod-produce 的 ProduceEvents.IOT_ALERT_RAISED 保持一致）。
 * 卫星服务不依赖业务模块，仅按契约序列化 payload。
 */
public final class IotTopics {

    public static final String IOT_ALERT_RAISED = "iot.alert.raised";

    private IotTopics() {
    }

    /** 与 ProduceEvents.IotAlertRaised 字段一一对应 */
    public record IotAlertPayload(String deviceNo, String metric, java.math.BigDecimal value,
                                  java.math.BigDecimal threshold, String level, String message,
                                  Long marketId, String raisedAt) {
    }
}
