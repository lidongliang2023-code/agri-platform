package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

/**
 * 主体资质证照。
 *
 * <p>挂在 merchant_id 上而不是 user_id 上：证照属于主体，不属于个人。
 * 到期预警不落库，由接口按 expireDate 现算，避免"存下来的预警状态"和今天对不上。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_merchant_certificate")
public class MerchantCertificateEntity extends BaseEntity {

    /** 经营主体 ID */
    private Long merchantId;

    /** 证照类型编码 */
    private String certType;

    /** 证照名称 */
    private String certName;

    /** 证照编号 */
    private String certNo;

    /** 发证机关 */
    private String issueOrg;

    /** 发证日期 */
    private LocalDate issueDate;

    /** 有效期至 */
    private LocalDate expireDate;

    /** 影像件地址 */
    private String fileUrl;

    /** active / revoked */
    private String status;

    /** 备注 */
    private String remark;
}
