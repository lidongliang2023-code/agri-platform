package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 农场食品安全风险评分（风险热力图）。主键用业务编号 risk_id。 */
@Data
@TableName("agri_prod_fs_farm_risk")
public class FarmRisk {

    @TableId(value = "risk_id", type = IdType.INPUT)
    private String riskId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("farm_id")
    private String farmId;

    @TableField("farm_name")
    private String farmName;

    /** 食品安全评分 0~100 */
    @TableField("score")
    private BigDecimal score;

    /** 统计日期（当期取每月 1 日为锚点） */
    @TableField("stat_date")
    private LocalDate statDate;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
