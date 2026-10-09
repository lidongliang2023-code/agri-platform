package com.agri.produce.internal.input;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

/**
 * 投入品供应商
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_supplier")
public class SupplierEntity extends ProduceBaseEntity {

    @TableId(value = "supplier_id", type = IdType.INPUT)
    private String supplierId;

    /** 供应商编码（租户内唯一） */
    private String supplierCode;

    /** 供应商名称 */
    private String supplierName;

    /** 联系人 */
    private String contactName;

    /** 联系电话 */
    private String contactPhone;

    /** 营业执照号 */
    private String licenseNo;

    /** 地址 */
    private String address;

    /** 信用等级 A/B/C */
    private String creditLevel;

    /** 合作起始日 */
    private LocalDate cooperateStart;

    /** 状态 1合作中 0已终止 */
    private Integer status;
}
