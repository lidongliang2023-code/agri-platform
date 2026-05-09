
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GatewayVO {
    private Long id;
    private String gatewayName;
    private String gatewayCode;
    private String gatewayType;
    private String ipAddress;
    private Integer port;
    private String firmwareVersion;
    private Integer status;
    private String statusText;
    private Integer deviceCount;
    private String createBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastOnlineTime;
}
