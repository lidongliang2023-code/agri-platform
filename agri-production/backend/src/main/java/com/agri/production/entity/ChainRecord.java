package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("agri_prod_chain_record")
public class ChainRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("record_no")
    private String recordNo;

    @TableField("chain_type")
    private String chainType;

    @TableField("target_type")
    private String targetType;

    @TableField("target_id")
    private Long targetId;

    @TableField("target_code")
    private String targetCode;

    @TableField("data_hash")
    private String dataHash;

    @TableField("tx_hash")
    private String txHash;

    @TableField("block_number")
    private Long blockNumber;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_time")
    private Date chainTime;

    @TableField("failed_reason")
    private String failedReason;

    @TableField("retry_count")
    private Integer retryCount;

    @TableField("next_retry_time")
    private Date nextRetryTime;

    @TableField("data_json")
    private String dataJson;

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