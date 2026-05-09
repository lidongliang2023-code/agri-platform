
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PlotVO {
    private Long id;
    private String plotName;
    private String plotCode;
    private Long farmId;
    private String farmName;
    private Double area;
    private String location;
    private Double latitude;
    private Double longitude;
    private Integer status;
    private String statusText;
    private String createBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}
