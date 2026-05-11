package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_merchant_guarantee")
public class MerchantGuarantee {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("merchant_id")
    private Long merchantId;

    @TableField("merchant_name")
    private String merchantName;

    @TableField("guarantee_no")
    private String guaranteeNo;

    @TableField("guarantee_type")
    private String guaranteeType;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("available_amount")
    private BigDecimal availableAmount;

    @TableField("frozen_amount")
    private BigDecimal frozenAmount;

    @TableField("used_amount")
    private BigDecimal usedAmount;

    @TableField("guarantee_status")
    private String guaranteeStatus;

    @TableField("apply_time")
    private Date applyTime;

    @TableField("verify_time")
    private Date verifyTime;

    @TableField("verified_by")
    private String verifiedBy;

    @TableField("expire_time")
    private Date expireTime;

    @TableField("renew_time")
    private Date renewTime;

    @TableField("bank_name")
    private String bankName;

    @TableField("bank_account")
    private String bankAccount;

    @TableField("certificate_url")
    private String certificateUrl;

    @TableField("remark")
    private String remark;

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