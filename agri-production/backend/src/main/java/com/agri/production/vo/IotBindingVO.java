package com.agri.production.vo;

import com.agri.production.entity.IotBinding;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 绑定关系出参（页面 IotBinding）。
 *
 * <p>字段名与页面契约逐项对齐；{@code metrics} 库里存逗号串、出参**转成数组**——
 * 页面直接对它做 {@code .map()}，给字符串会在有真实数据时崩（空列表时反而看不出来）。</p>
 */
@Data
public class IotBindingVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String bindingId;
    private String deviceId;
    private String deviceCode;
    private String deviceName;
    /** PLOT / GREENHOUSE / FARM */
    private String bindType;
    private String bindTargetId;
    private String bindTargetName;
    private List<String> metrics;
    /** 采集频率（分钟），未设置为 null */
    private Integer frequency;
    /** BOUND / UNBOUND / PAUSED */
    private String status;
    /** yyyy-MM-dd HH:mm:ss */
    private String boundAt;
    /** 解绑时间（页面不显示，便于运维核对） */
    private String unboundAt;

    public static IotBindingVO of(IotBinding entity) {
        if (entity == null) {
            return null;
        }
        IotBindingVO vo = new IotBindingVO();
        vo.bindingId = entity.getBindingId();
        vo.deviceId = entity.getDeviceId();
        vo.deviceCode = entity.getDeviceCode();
        vo.deviceName = entity.getDeviceName();
        vo.bindType = entity.getBindType();
        vo.bindTargetId = entity.getBindTargetId();
        vo.bindTargetName = entity.getBindTargetName();
        vo.metrics = split(entity.getMetrics());
        vo.frequency = entity.getFrequency();
        vo.status = entity.getStatus();
        vo.boundAt = entity.getBoundAt() == null ? null : DATETIME.format(entity.getBoundAt());
        vo.unboundAt = entity.getUnboundAt() == null ? null : DATETIME.format(entity.getUnboundAt());
        return vo;
    }

    /** 逗号串 → 数组（去空、去重保序）。 */
    public static List<String> split(String raw) {
        List<String> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        for (String part : raw.split("[,，]")) {
            String item = part.trim();
            if (!item.isEmpty() && !result.contains(item)) {
                result.add(item);
            }
        }
        return result;
    }
}
