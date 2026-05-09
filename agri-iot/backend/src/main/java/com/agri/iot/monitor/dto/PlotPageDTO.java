package com.agri.monitor.dto;

import lombok.Data;

@Data
public class PlotPageDTO {
    private Integer pageNum = 1;
    private Integer pageSize = 10;
    private String plotCode;
    private String plotName;
    private String cropType;
    private Integer status;
}
