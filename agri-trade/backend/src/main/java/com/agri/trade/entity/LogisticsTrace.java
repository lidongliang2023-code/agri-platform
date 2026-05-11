package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_logistics_trace")
public class LogisticsTrace {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("logistics_id")
    private Long logisticsId;

    @TableField("logistics_no")
    private String logisticsNo;

    @TableField("trace_no")
    private String traceNo;

    @TableField("trace_time")
    private Date traceTime;

    @TableField("trace_status")
    private String traceStatus;

    @TableField("trace_location")
    private String traceLocation;

    @TableField("trace_lat")
    private BigDecimal traceLat;

    @TableField("trace_lng")
    private BigDecimal traceLng;

    @TableField("trace_description")
    private String traceDescription;

    @TableField("operator")
    private String operator;

    @TableField("operator_phone")
    private String operatorPhone;

    @TableField("next_location")
    private String nextLocation;

    @TableField("temperature")
    private BigDecimal temperature;

    @TableField("is_significant")
    private Integer isSignificant;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private Date createTime;
}