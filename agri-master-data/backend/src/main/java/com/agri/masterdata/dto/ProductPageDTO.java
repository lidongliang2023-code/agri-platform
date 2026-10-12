package com.agri.masterdata.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ProductPageDTO extends PageVO {

    private String productCode;

    private String productName;

    private Long categoryId;

    private Integer status;
}
