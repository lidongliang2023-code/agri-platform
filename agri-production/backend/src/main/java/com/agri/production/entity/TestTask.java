package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_test_task")
public class TestTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("task_no")
    private String taskNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("test_type")
    private String testType;

    @TableField("test_category")
    private String testCategory;

    @TableField("test_org_id")
    private Long testOrgId;

    @TableField("test_org_name")
    private String testOrgName;

    @TableField("sample_no")
    private String sampleNo;

    @TableField("sample_source")
    private String sampleSource;

    @TableField("sample_amount")
    private String sampleAmount;

    @TableField("sampling_date")
    private Date samplingDate;

    @TableField("sampler")
    private String sampler;

    @TableField("sampling_location")
    private String samplingLocation;

    @TableField("test_requirements")
    private String testRequirements;

    @TableField("task_status")
    private String taskStatus;

    @TableField("expected_complete_date")
    private Date expectedCompleteDate;

    @TableField("actual_complete_date")
    private Date actualCompleteDate;

    @TableField("total_fee")
    private BigDecimal totalFee;

    @TableField("report_delivery_type")
    private String reportDeliveryType;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;

    @TableField("remark")
    private String remark;
}