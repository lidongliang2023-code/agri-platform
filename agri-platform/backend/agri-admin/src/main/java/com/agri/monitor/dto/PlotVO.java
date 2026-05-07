package com.agri.monitor.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PlotVO {
    private Long id;
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
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Integer deviceCount;
    private Integer onlineDeviceCount;
}
