package com.agri.production.dto;

import lombok.Data;

@Data
public class PlotPageDTO {

    private String plotName;

    private Long farmId;

    private String currentCrop;

    private String status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}