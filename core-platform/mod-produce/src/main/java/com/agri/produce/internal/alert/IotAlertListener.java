package com.agri.produce.internal.alert;

import com.agri.core.infra.event.TopicListener;
import com.agri.core.infra.util.JsonUtil;
import com.agri.produce.api.event.ProduceEvents;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * IoT 预警消费（卫星服务 → 核心单体）：落预警台账 + 联动控制接续点。
 * 消费端幂等：重复告警追加记录，台账语义允许（去重可按 device_no+raised_at 扩展）。
 *
 * <p>路径挂在 /api/v1/production/iot/alerts 下，与告警域主接口
 * /api/v1/production/alerts（AlertController）区分，避免映射冲突。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/production/iot/alerts")
@RequiredArgsConstructor
public class IotAlertListener implements TopicListener {

    private final IotAlertMapper alertMapper;

    @Override
    public String topic() {
        return ProduceEvents.IOT_ALERT_RAISED;
    }

    @Override
    public void onMessage(String payload) {
        ProduceEvents.IotAlertRaised event = JsonUtil.parse(payload, ProduceEvents.IotAlertRaised.class);
        IotAlertEntity alert = new IotAlertEntity();
        alert.setDeviceNo(event.deviceNo());
        alert.setMetric(event.metric());
        alert.setValue(event.value());
        alert.setThreshold(event.threshold());
        // 入站归一化：上游 satellite-iot 写的是旧词表 CRITICAL/WARN，原样落库会让
        // V18 迁完之后新数据继续灌旧值，"迁移完成"再次失效。统一归一到 PRD 8.1.2 词表。
        // 无法识别的级别原样保留并打 warn（见 AlertDict#normalizeLevel），不做静默替换。
        alert.setLevel(AlertDict.normalizeLevel(event.level()));
        alert.setMessage(event.message());
        if (event.marketId() != null) {
            alert.setMarketId(event.marketId());
        }
        alertMapper.insert(alert);
        log.warn("[produce] IoT 预警: {} {} = {}（阈值 {}）", event.deviceNo(), event.metric(),
                event.value(), event.threshold());
    }

    @GetMapping
    public ApiResponse<PageResult<IotAlertEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String level) {
        Page<IotAlertEntity> result = alertMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<IotAlertEntity>()
                        .eq(level != null && !level.isBlank(), IotAlertEntity::getLevel, level)
                        .orderByDesc(IotAlertEntity::getCreatedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }
}
