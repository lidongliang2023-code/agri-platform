package com.agri.monitor.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PlotSaveDTO {
    private String plotCode;
    private String plotName;
    private BigDecimal area;
    private String cropType;
    private Integer status;
    private String location;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String soilType;
    private String irrigationType;
    private String remark;
}
