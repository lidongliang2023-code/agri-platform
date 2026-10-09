package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * IoT 设备绑定关系（设备 × 地块 / 大棚 / 农场）。
 *
 * <p>{@code metrics} 在库内以逗号分隔存放（如 {@code temperature,humidity,soil_moisture}），
 * 对外统一经 {@link IotBindingVO} 暴露为数组，避免前端自行拆串。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_binding")
public class IotBindingEntity extends ProduceBaseEntity {

    /** 绑定对象类型：地块 */
    public static final String BIND_TYPE_PLOT = "PLOT";
    /** 绑定对象类型：大棚 */
    public static final String BIND_TYPE_GREENHOUSE = "GREENHOUSE";
    /** 绑定对象类型：农场 */
    public static final String BIND_TYPE_FARM = "FARM";

    /** 状态：已绑定 */
    public static final String STATUS_BOUND = "BOUND";
    /** 状态：已解绑 */
    public static final String STATUS_UNBOUND = "UNBOUND";
    /** 状态：暂停采集 */
    public static final String STATUS_PAUSED = "PAUSED";

    @TableId(value = "binding_id", type = IdType.INPUT)
    private String bindingId;

    /** 设备ID */
    private String deviceId;

    /** 设备编码（冗余，便于检索） */
    private String deviceCode;

    /** 设备名称（冗余，便于列表展示） */
    private String deviceName;

    /** 绑定对象类型 PLOT/GREENHOUSE/FARM */
    private String bindType;

    /** 绑定对象ID（地块ID / 大棚ID / 农场ID） */
    private String bindTargetId;

    /** 绑定对象名称（冗余，便于列表展示） */
    private String bindTargetName;

    /** 采集指标（逗号分隔） */
    private String metrics;

    /** 采集频率（分钟） */
    private Integer frequency;

    /** 状态 BOUND/UNBOUND/PAUSED */
    private String status;

    /** 绑定时间 */
    private LocalDateTime boundAt;
}
