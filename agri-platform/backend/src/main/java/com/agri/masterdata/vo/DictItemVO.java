package com.agri.masterdata.vo;

import lombok.Data;

@Data
public class DictItemVO {

    private Long id;

    private Long dictId;

    private String itemText;

    private String itemValue;

    private Integer itemSort;

    private Integer status;
}
