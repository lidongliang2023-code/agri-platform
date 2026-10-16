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
 * IoT 指令记录（页面 IotCommand）。
 *
 * <p>本部署没有设备下发通道：状态统一落 {@code ISSUED}（已记录），回执里写明未实际送达 ——
 * 不按"设备在线就算成功"编一个执行结果出来。详见 schema-mysql.sql 的建表注释。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_iot_command")
public class IotCommand extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("command_id")
    private String commandId;

    @TableField("device_id")
    private String deviceId;

    @TableField("device_code")
    private String deviceCode;

    @TableField("command_type")
    private String commandType;

    @TableField("params")
    private String params;

    @TableField("operator")
    private String operator;

    /** ISSUED（本部署唯一取值）/ PENDING / SUCCESS / FAILED */
    @TableField("status")
    private String status;

    @TableField("receipt")
    private String receipt;

    @TableField("send_at")
    private LocalDateTime sendAt;

    @TableField("receipt_at")
    private LocalDateTime receiptAt;
}
