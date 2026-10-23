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

    private String alertLevel;

    private String alertContent;

    private LocalDateTime monitorTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}