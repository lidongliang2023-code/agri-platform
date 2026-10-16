package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** IoT 设备维修/保养记录（页面 IotMaintenance）。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_iot_maintenance")
public class IotMaintenance extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("maintain_id")
    private String maintainId;

    @TableField("device_id")
    private String deviceId;

    @TableField("device_code")
    private String deviceCode;

    /** INSPECT / REPAIR / REPLACE / CALIBRATE / UPGRADE */
    @TableField("maintain_type")
    private String maintainType;

    @TableField("content")
    private String content;

    @TableField("operator")
    private String operator;

    @TableField("maintain_at")
    private LocalDateTime maintainAt;

    @TableField("result")
    private String result;

    /** 下次保养日期（页面暂无此字段，预留给保养计划） */
    @TableField("next_maintain_at")
    private LocalDateTime nextMaintainAt;
}
