package com.agri.produce.internal.iot;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 设备绑定关系视图对象：把库内逗号分隔的采集指标转换为数组，供前端直接消费。
 */
@Data
public class IotBindingVO {

    private String bindingId;
    private String deviceId;
    private String deviceCode;
    private String deviceName;
    /** 绑定对象类型 PLOT/GREENHOUSE/FARM */
    private String bindType;
    /** 绑定对象ID（地块ID / 大棚ID / 农场ID） */
    private String bindTargetId;
    /** 绑定对象名称 */
    private String bindTargetName;
    /** 采集指标（数组） */
    private List<String> metrics;
    /** 采集频率（分钟） */
    private Integer frequency;
    /** 状态 BOUND/UNBOUND/PAUSED */
    private String status;
    private LocalDateTime boundAt;

    /**
     * 由实体转换为视图对象。
     *
     * @param entity 绑定关系实体，可为 null
     * @return 视图对象；入参为 null 时返回 null
     */
    public static IotBindingVO of(IotBindingEntity entity) {
        if (entity == null) {
            return null;
        }
        IotBindingVO vo = new IotBindingVO();
        vo.setBindingId(entity.getBindingId());
        vo.setDeviceId(entity.getDeviceId());
        vo.setDeviceCode(entity.getDeviceCode());
        vo.setDeviceName(entity.getDeviceName());
        vo.setBindType(entity.getBindType());
        vo.setBindTargetId(entity.getBindTargetId());
        vo.setBindTargetName(entity.getBindTargetName());
        vo.setMetrics(splitMetrics(entity.getMetrics()));
        vo.setFrequency(entity.getFrequency());
        vo.setStatus(entity.getStatus());
        vo.setBoundAt(entity.getBoundAt());
        return vo;
    }

    /**
     * 列表批量转换。
     *
     * @param entities 实体列表
     * @return 视图对象列表，入参为 null 时返回空列表
     */
    public static List<IotBindingVO> ofList(List<IotBindingEntity> entities) {
        if (entities == null) {
            return Collections.emptyList();
        }
        List<IotBindingVO> result = new ArrayList<>(entities.size());
        for (IotBindingEntity entity : entities) {
            result.add(of(entity));
        }
        return result;
    }

    /**
     * 把逗号分隔的指标串解析为数组，自动去空白与空项。
     *
     * @param raw 原始串，可为 null
     * @return 指标数组，永不返回 null
     */
    public static List<String> splitMetrics(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        List<String> metrics = new ArrayList<>();
        for (String part : Arrays.asList(raw.split(","))) {
            String trimmed = part == null ? "" : part.trim();
            if (!trimmed.isEmpty()) {
                metrics.add(trimmed);
            }
        }
        return metrics;
    }
}
