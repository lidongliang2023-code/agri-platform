package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_dict_item")
public class DictItem extends BaseEntity {

    private Long dictId;

    /**
     * 所属字典编码。
     *
     * <p>这一列是从旧结构沿用下来的，在库里是 **NOT NULL 且无默认值**，与 dict_id 并存。
     * 实体原先没有这个字段，于是新增字典项时 MyBatis-Plus 的 INSERT 不会带它，
     * 数据库直接报 `Field 'dict_code' doesn't have a default value`。</p>
     */
    private String dictCode;

    private String itemCode;

    private String itemName;

    private String itemText;

    private String itemValue;

    private Integer sortOrder;

    private Integer itemSort;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
