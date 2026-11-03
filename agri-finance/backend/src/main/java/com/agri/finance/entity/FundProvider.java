package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("fund_provider")
public class FundProvider {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String providerNo;

    private String institutionType;

    private String institutionName;

    private String creditCode;

    /** 绑定的平台经营主体号：资金方登录身份由此反查机构，不接受前端自报机构号。 */
    private String merchantId;

    private BigDecimal registeredCapital;

    private Integer establishedYear;

    private String businessLicense;

    private String financialLicense;

    private String operationLicense;

    private String contactName;

    private String contactPhone;

    private String contactEmail;

    private String status;

    private String reviewStatus;

    private String reviewOpinion;

    private String reviewerId;

    private LocalDateTime reviewTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}