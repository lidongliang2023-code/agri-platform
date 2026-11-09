package com.agri.common.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Map;

/**
 * 现代农业产业互联网 AI 中台统一响应结果对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInvokeResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 是否执行成功
     */
    private boolean ok;

    /**
     * AI 中台全局任务流水号 (ait-xxxxxxxx)
     */
    private String taskId;

    /**
     * 任务状态 (SUCCESS / FAILED / RUNNING)
     */
    private String status;

    /**
     * 场景编码
     */
    private String sceneCode;

    /**
     * 业务结构化产出结果 (落库至业务主表的目标数据)
     */
    private Map<String, Object> result;

    /**
     * 计量消耗 (input_tokens, output_tokens, latency_ms)
     */
    private Map<String, Object> usage;

    /**
     * 分布式链路追踪 Trace ID
     */
    private String traceId;

    /**
     * 错误信息或异常提示 (若失败)
     */
    private String message;
}
