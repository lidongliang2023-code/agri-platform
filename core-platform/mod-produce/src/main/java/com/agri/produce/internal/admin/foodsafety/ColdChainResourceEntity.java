package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 冷链资源（P19）。
 *
 * <p>P15 的「冷链达标率」口径 = 非离线资源占比（idle + busy）/ 资源总数，
 * 数据源即本表，与 P19 页面同源。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_cold_chain_resource")
public class ColdChainResourceEntity extends ProduceBaseEntity {

    /** 资源编号（业务主键，JSON 字段名 id） */
    @TableId(value = "resource_id", type = IdType.INPUT)
    private String id;

    /** 资源名称（车牌号 / 库区名；JSON 字段名 name，契约 §6.2） */
    @TableField("resource_name")
    private String name;

    /** 资源类型：vehicle / warehouse（JSON 字段名 type，契约 §6.2） */
    @TableField("resource_type")
    private String type;

    /** 类型文案：冷链车 / 冷库 */
    private String typeLabel;

    /** 规格文案 */
    private String spec;

    /** 温区文案 */
    private String tempRange;

    /** 所在城市 */
    private String city;

    /** 所在区县 */
    private String district;

    /** 状态：idle / busy / offline */
    @TableField("resource_status")
    private String status;

    /** 服务评分 0~5 */
    private BigDecimal rating;

    /** 联系人（JSON 字段名 contact，契约 §6.2） */
    @TableField("contact_name")
    private String contact;

    /** 联系电话（JSON 字段名 phone，契约 §6.2） */
    @TableField("contact_phone")
    private String phone;

    /** 最近保养日期 */
    private LocalDate lastMaintainDate;
}
