package com.agri.common.vo;

import lombok.Data;

@Data
public class PageVO {

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
