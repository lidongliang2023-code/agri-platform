package com.agri.platform.internal.merchant;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 经营主体认证申请。
 *
 * <p>每一次提交都是一条记录（含被驳回后重新提交的），而不是只维护一个状态 ——
 * 商家会问"我上次为什么被驳回"，而那条理由如果被新的提交覆盖掉了就再也答不上来。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_merchant_certification")
public class MerchantCertificationEntity extends BaseEntity {

    private Long merchantId;

    /** 提交时的主体名称快照 */
    private String merchantName;

    private String certNo;

    private String companyName;

    /** 统一社会信用代码 */
    private String creditCode;

    private String legalPerson;

    private String licenseNo;

    private String contactName;

    private String contactPhone;

    /** 材料说明（当前阶段只登记说明文本，不存文件） */
    private String attachNote;

    /** pending 待审核 / approved 已通过 / rejected 已驳回 */
    private String certStatus;

    private LocalDateTime submitTime;

    private String reviewer;

    private LocalDateTime reviewTime;

    /** 审核意见（驳回时必须填） */
    private String reviewRemark;
}
