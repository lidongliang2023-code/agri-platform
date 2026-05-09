
package com.agri.iot.dto.request;

import lombok.Data;

@Data
public class GatewayQueryDTO {
    private String gatewayName;
    private String tenantId;
    private Integer status;
    private Integer pageNum;
    private Integer pageSize;
}
