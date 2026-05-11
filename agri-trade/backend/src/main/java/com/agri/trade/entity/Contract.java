package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_contract")
public class Contract {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("contract_no")
    private String contractNo;

    @TableField("contract_name")
    private String contractName;

    @TableField("contract_type")
    private String contractType;

    @TableField("template_id")
    private Long templateId;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("buyer_id")
    private Long buyerId;

    @TableField("buyer_name")
    private String buyerName;

    @TableField("buyer_sign_status")
    private String buyerSignStatus;

    @TableField("buyer_sign_time")
    private Date buyerSignTime;

    @TableField("buyer_sign_ip")
    private String buyerSignIp;

    @TableField("buyer_signature")
    private String buyerSignature;

    @TableField("seller_id")
    private Long sellerId;

    @TableField("seller_name")
    private String sellerName;

    @TableField("seller_sign_status")
    private String sellerSignStatus;

    @TableField("seller_sign_time")
    private Date sellerSignTime;

    @TableField("seller_sign_ip")
    private String sellerSignIp;

    @TableField("seller_signature")
    private String sellerSignature;

    @TableField("contract_content")
    private String contractContent;

    @TableField("contract_hash")
    private String contractHash;

    @TableField("contract_file_url")
    private String contractFileUrl;

    @TableField("contract_amount")
    private BigDecimal contractAmount;

    @TableField("delivery_date")
    private Date deliveryDate;

    @TableField("delivery_address")
    private String deliveryAddress;

    @TableField("sign_date")
    private Date signDate;

    @TableField("effective_date")
    private Date effectiveDate;

    @TableField("expire_date")
    private Date expireDate;

    @TableField("contract_status")
    private String contractStatus;

    @TableField("archive_status")
    private String archiveStatus;

    @TableField("archive_time")
    private Date archiveTime;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

    @TableField("chain_time")
    private Date chainTime;

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