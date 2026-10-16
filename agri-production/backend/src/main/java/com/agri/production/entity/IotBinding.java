package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * IoT 设备绑定关系（页面 IotBinding）。
 *
 * <p>列的口径与"为什么要冗余设备名/对象名"写在 schema-mysql.sql 的建表注释里。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_iot_binding")
public class IotBinding extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("binding_id")
    private String bindingId;

    @TableField("device_id")
    private String deviceId;

    @TableField("device_code")
    private String deviceCode;

    @TableField("device_name")
    private String deviceName;

    /** PLOT / GREENHOUSE / FARM */
    @TableField("bind_type")
    private String bindType;

    @TableField("bind_target_id")
    private String bindTargetId;

    @TableField("bind_target_name")
    private String bindTargetName;

    /** 采集指标（逗号分隔） */
    @TableField("metrics")
    private String metrics;

    /** 采集频率（分钟） */
    @TableField("frequency")
    private Integer frequency;

    /** BOUND / UNBOUND / PAUSED */
    @TableField("status")
    private String status;

    @TableField("bound_at")
    private LocalDateTime boundAt;

    @TableField("unbound_at")
    private LocalDateTime unboundAt;

    @TableField("remark")
    private String remark;
}
