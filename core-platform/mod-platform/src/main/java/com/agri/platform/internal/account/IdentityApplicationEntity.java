package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 身份申请单。
 *
 * <p>只负责"申请 + 审核"这条单子；审核通过**不改主体绑定关系、不改 RBAC** ——
 * 是否据此开通权限由权限模块另行决定，这里不越界。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_identity_application")
public class IdentityApplicationEntity extends BaseEntity {

    private Long userId;

    /** 身份类型：wholesaler / retailer / farmer / coop_admin / mall_supplier / service_provider / government */
    private String identityType;

    private Long merchantId;
    private String subjectName;
    private String creditCode;
    private String businessPlace;
    private String businessCategory;
    private String annualVolume;
    private String contactName;
    private String contactPhone;
    private String applyNote;

    /** pending / approved / rejected / cancelled */
    private String status;

    private Long reviewerId;
    private String reviewerName;
    private LocalDateTime reviewTime;
    private String reviewRemark;
}
