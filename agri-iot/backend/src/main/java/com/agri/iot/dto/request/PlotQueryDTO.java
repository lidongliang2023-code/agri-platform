
package com.agri.iot.dto.request;

import lombok.Data;

@Data
public class PlotQueryDTO {
    private String plotName;
    private String tenantId;
    private Integer status;
    private Integer pageNum;
    private Integer pageSize;
}
