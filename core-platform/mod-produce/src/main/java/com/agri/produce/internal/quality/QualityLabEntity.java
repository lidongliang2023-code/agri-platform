package com.agri.produce.internal.quality;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 检测机构/实验室（资质与认可范围）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_quality_lab")
public class QualityLabEntity extends ProduceBaseEntity {

    @TableId(value = "lab_id", type = IdType.INPUT)
    private String labId;

    /** 机构编码（租户内唯一） */
    private String labCode;

    /** 机构名称 */
    private String labName;

    /** 机构类型 第三方/政府/自建 */
    private String labType;

    /** 联系人 */
    private String contactName;

    /** 联系电话 */
    private String contactPhone;

    /** 地址 */
    private String address;

    /** 资质编号 */
    private String qualificationNo;

    /** 认可检测范围 */
    private String accreditedScope;

    /** 状态 1合作中 0已终止 */
    private Integer status;
}
