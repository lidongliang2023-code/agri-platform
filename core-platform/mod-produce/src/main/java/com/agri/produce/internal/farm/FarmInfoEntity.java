package com.agri.produce.internal.farm;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 农场档案（生产基地主数据）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_farm_info")
public class FarmInfoEntity extends ProduceBaseEntity {

    @TableId(value = "farm_id", type = IdType.INPUT)
    private String farmId;

    /** 农场编码（租户内唯一） */
    private String farmCode;

    /** 农场名称 */
    private String farmName;

    /** 农场类型 1种植 2养殖 3混合 */
    private Integer farmType;

    /** 省 */
    private String province;

    /** 市 */
    private String city;

    /** 区县 */
    private String district;

    /** 详细地址 */
    private String address;

    /** 总面积（亩） */
    private BigDecimal areaTotal;

    /** 负责人 */
    private String managerName;

    /** 联系电话 */
    private String managerPhone;

    /** 状态 1启用 0停用 */
    private Integer status;

    /** 备注（V7 新增列 prod_farm_info.remark） */
    private String remark;
}
