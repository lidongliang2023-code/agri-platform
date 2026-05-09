package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_test_record")
public class TestRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("record_no")
    private String recordNo;

    @TableField("task_id")
    private Long taskId;

    @TableField("batch_no")
    private String batchNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("product_name")
    private String productName;

    @TableField("test_type")
    private String testType;

    @TableField("test_items_json")
    private String testItemsJson;

    @TableField("test_results_json")
    private String testResultsJson;

    @TableField("conclusion")
    private String conclusion;

    @TableField("is_qualified")
    private Integer isQualified;

    @TableField("test_date")
    private Date testDate;

    @TableField("report_no")
    private String reportNo;

    @TableField("report_url")
    private String reportUrl;

    @TableField("test_org_name")
    private String testOrgName;

    @TableField("auditor")
    private String auditor;

    @TableField("audit_time")
    private Date auditTime;

    @TableField("audit_status")
    private String auditStatus;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

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
}