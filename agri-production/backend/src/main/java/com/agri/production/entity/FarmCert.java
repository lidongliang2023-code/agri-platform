package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

/** 农场资质证照（页面 FarmCert）。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_farm_cert")
public class FarmCert extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("cert_id")
    private String certId;

    @TableField("farm_id")
    private Long farmId;

    @TableField("cert_type")
    private String certType;

    @TableField("cert_name")
    private String certName;

    @TableField("cert_no")
    private String certNo;

    @TableField("issuer")
    private String issuer;

    @TableField("issue_date")
    private LocalDate issueDate;

    @TableField("expire_date")
    private LocalDate expireDate;

    @TableField("attach_url")
    private String attachUrl;

    /** 0 作废 / 1 有效 / 2 临期 / 3 过期 */
    @TableField("status")
    private Integer status;
}
