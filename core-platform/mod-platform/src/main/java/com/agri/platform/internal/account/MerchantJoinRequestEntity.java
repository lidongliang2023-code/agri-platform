package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 用户申请加入经营主体。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_merchant_join_request")
public class MerchantJoinRequestEntity extends BaseEntity {

    private Long userId;
    private Long merchantId;
    private String requestedRole;
    private String message;
    /** pending / approved / rejected / cancelled */
    private String status;
    private Long reviewerId;
    private String reviewerName;
    private LocalDateTime reviewTime;
    private String reviewRemark;
}
