package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_dict_item")
public class DictItem extends BaseEntity {

    private Long dictId;

    private String itemText;

    private String itemValue;

    private Integer itemSort;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
