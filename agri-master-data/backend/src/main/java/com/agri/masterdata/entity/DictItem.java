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
