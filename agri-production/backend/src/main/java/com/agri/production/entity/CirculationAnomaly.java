package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 流通异常（食品安全-流通异常检测）。主键用业务编号 anomaly_id。 */
@Data
@TableName("agri_prod_fs_circulation_anomaly")
public class CirculationAnomaly {

    @TableId(value = "anomaly_id", type = IdType.INPUT)
    private String anomalyId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("batch_no")
    private String batchNo;

    @TableField("product_name")
    private String productName;

    /** temperature 温度异常 / overtime 超时滞留 / label 标签异常 */
    @TableField("anomaly_type")
    private String anomalyType;

    /** severe 严重 / medium 中等 / minor 轻微 */
    @TableField("severity")
    private String severity;

    /** 影响范围（页面直接显示，如 50kg） */
    @TableField("impact_range")
    private String impactRange;

    @TableField("found_time")
    private LocalDateTime foundTime;

    @TableField("found_date")
    private LocalDate foundDate;

    /** pending 待处理 / processing 处理中 / done 已处理 */
    @TableField("status")
    private String status;

    @TableField("measure")
    private String measure;

    @TableField("handle_remark")
    private String handleRemark;

    @TableField("handle_by")
    private Long handleBy;

    @TableField("handle_time")
    private LocalDateTime handleTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
