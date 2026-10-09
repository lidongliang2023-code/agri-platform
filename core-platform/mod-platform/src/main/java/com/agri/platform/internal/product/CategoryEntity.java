package com.agri.platform.internal.product;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 类目（统一商品类目与编码）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_category")
public class CategoryEntity extends BaseEntity {

    private Long parentId;
    private String code;
    private String name;
    private Integer level;
}
