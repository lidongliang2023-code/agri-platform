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
