package com.agri.monitor.dto;

import lombok.Data;

@Data
public class GatewayPageDTO {
    private Integer pageNum = 1;
    private Integer pageSize = 10;
    private String gatewayCode;
    private String gatewayName;
    private Integer plotId;
    private Integer onlineStatus;
}
