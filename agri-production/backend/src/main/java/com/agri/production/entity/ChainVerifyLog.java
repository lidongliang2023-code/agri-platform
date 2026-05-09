package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("agri_prod_chain_verify_log")
public class ChainVerifyLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("log_no")
    private String logNo;

    @TableField("chain_record_id")
    private Long chainRecordId;

    @TableField("target_type")
    private String targetType;

    @TableField("target_id")
    private Long targetId;

    @TableField("tx_hash")
    private String txHash;

    @TableField("verify_status")
    private String verifyStatus;

    @TableField("verify_time")
    private Date verifyTime;

    @TableField("verified_by")
    private String verifiedBy;

    @TableField("verify_result_json")
    private String verifyResultJson;

    @TableField("remark")
    private String remark;

    @TableField("create_time")
    private Date createTime;
}