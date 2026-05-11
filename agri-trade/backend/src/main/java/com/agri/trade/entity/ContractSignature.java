package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("agri_trade_contract_signature")
public class ContractSignature {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("contract_id")
    private Long contractId;

    @TableField("signatory_type")
    private String signatoryType;

    @TableField("signatory_id")
    private Long signatoryId;

    @TableField("signatory_name")
    private String signatoryName;

    @TableField("sign_status")
    private String signStatus;

    @TableField("sign_time")
    private Date signTime;

    @TableField("sign_ip")
    private String signIp;

    @TableField("signature_data")
    private String signatureData;

    @TableField("certificate_no")
    private String certificateNo;

    @TableField("sign_device")
    private String signDevice;

    @TableField("sign_method")
    private String signMethod;

    @TableField("sign_result")
    private String signResult;

    @TableField("fail_reason")
    private String failReason;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;
}