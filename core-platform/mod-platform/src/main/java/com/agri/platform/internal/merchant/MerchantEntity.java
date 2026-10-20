package com.agri.platform.internal.merchant;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 客商（客户/供应商统一主数据）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_merchant")
public class MerchantEntity extends BaseEntity {

    private String code;
    private String name;
    /** CUSTOMER / SUPPLIER / BOTH */
    private String type;

    /** 会员身份：enterprise 企业 / personal 个人（2026-10-20 注册时写入，历史数据为空） */
    private String memberType;

    /** 企业所属行业 */
    private String industry;

    /** 企业规模 */
    private String companySize;

    /** 注册地址 */
    private String address;

    /** 个人经营类型（家庭农场 / 农民专业合作社 / 个体采购户 / 经纪人 / 其他） */
    private String businessType;

    private String creditCode;
    private String contactName;
    private String contactPhone;

    /** 1=正常 0=禁用 */
    private Integer status;

    /** 认证状态：unverified 未认证 / pending 待审核 / approved 已认证 / rejected 已驳回 */
    private String verifyStatus;

    private java.time.LocalDateTime verifyTime;

    /** 最近一次审核意见 */
    private String verifyRemark;
}
