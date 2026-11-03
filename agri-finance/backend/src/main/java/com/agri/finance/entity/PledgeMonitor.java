package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pledge_monitor")
public class PledgeMonitor {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String receiptId;

    private String receiptNo;

    private BigDecimal realtimeWeight;

    private BigDecimal temperature;

    private BigDecimal humidity;

    private BigDecimal gasConcentration;

    private String deviceStatus;

    /** 读数来自哪台设备（没有这层出处，页面上的温度就成了"不知道是谁的读数"）。 */
    private String deviceCode;

    /** 读数口径说明：本批次地块没有绑定传感器时，如实说明读数来自主体名下其它设备。 */
    private String deviceNote;

    private String alertLevel;

    private String alertContent;

    private LocalDateTime monitorTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}