package com.agri.common.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Map;

/**
 * 现代农业产业互联网 AI 中台统一调用请求对象
 * 符合 PRD 统一协议标准 (Scene-driven & Subsystem isolated)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInvokeRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 业务场景编码 (如 farm.crop.schedule, iot.device.anomaly)
     */
    private String sceneCode;

    /**
     * 调用方业务子系统标识 (farm_prod, iot_sensor, trade_match, s2b2c, gov_supervise, supply_fin, info_news, service_hub)
     */
    private String bizSystem;

    /**
     * 业务单据/实体标识 (如作物批次ID, 设备ID, 订单号)
     */
    private String bizId;

    /**
     * 请求幂等跟踪流水号
     */
    private String requestId;

    /**
     * 业务结构化入参 (作物、时序、报价、供需单据等参数)
     */
    private Map<String, Object> input;

    /**
     * 执行选项 (如知识库增强开关、模拟试跑等)
     */
    private Map<String, Object> options;
}
