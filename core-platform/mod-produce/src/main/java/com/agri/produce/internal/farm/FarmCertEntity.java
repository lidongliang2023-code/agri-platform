package com.agri.produce.internal.farm;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

/**
 * 农场认证（绿色/有机/无公害等）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_farm_cert")
public class FarmCertEntity extends ProduceBaseEntity {

    @TableId(value = "cert_id", type = IdType.INPUT)
    private String certId;

    /** 所属农场ID */
    private String farmId;

    /** 认证类型 GREEN/ORGANIC/GEO/HACCP */
    private String certType;

    /** 认证名称 */
    private String certName;

    /** 认证编号 */
    private String certNo;

    /** 发证机构 */
    private String issuer;

    /** 发证日期 */
    private LocalDate issueDate;

    /** 有效期至 */
    private LocalDate expireDate;

    /** 证书附件 */
    private String attachUrl;

    /** 状态 1有效 2临期 3过期 0作废 */
    private Integer status;
}
