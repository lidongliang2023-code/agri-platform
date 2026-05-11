package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_quality_inspection")
public class QualityInspection extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("inspection_code")
    private String inspectionCode;

    @TableField("harvest_id")
    private Long harvestId;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("product_name")
    private String productName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("inspection_type")
    private String inspectionType;

    @TableField("inspection_date")
    private java.time.LocalDateTime inspectionDate;

    @TableField("inspector")
    private String inspector;

    @TableField("inspection_items")
    private String inspectionItems;

    @TableField("inspection_result")
    private String inspectionResult;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("is_qualified")
    private Integer isQualified;

    @TableField("unqualified_reason")
    private String unqualifiedReason;

    @TableField("suggestion")
    private String suggestion;

    @TableField("certificate_no")
    private String certificateNo;

    @TableField("attachment_urls")
    private String attachmentUrls;

    @TableField("status")
    private String status;
}