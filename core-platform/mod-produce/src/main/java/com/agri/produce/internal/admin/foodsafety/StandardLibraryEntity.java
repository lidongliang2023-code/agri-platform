package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 行业标准库（P17 Tab3 下拉数据源）。
 *
 * <p>Java 字段名直接对齐契约的 {@code value} / {@code label}（下拉项结构），
 * 列名走 {@code @TableField} 映射。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_standard_library")
public class StandardLibraryEntity extends ProduceBaseEntity {

    /** 标准编号（业务主键，JSON 字段名 value） */
    @TableId(value = "standard_no", type = IdType.INPUT)
    private String value;

    /** 标准全称（JSON 字段名 label） */
    @TableField("standard_name")
    private String label;

    /** 发布机构 */
    private String issuer;

    /** 状态 1启用 0停用 */
    private Integer status;

    /** 排序号 */
    private Integer sortNo;
}
