
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class DeviceGroupVO {

    private Long id;

    private String groupName;

    private String groupIcon;

    private String groupColor;

    private String description;

    private Integer isPreset;

    private Integer deviceCount;

    private Integer onlineCount;

    private Integer offlineCount;

    private Integer alertCount;

    private Integer status;

    private String statusText;

    private String createBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    private List<DeviceVO> devices;
}
