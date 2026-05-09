
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PushNotificationVO {

    private String notificationId;

    private String type;

    private String typeText;

    private String level;

    private String levelText;

    private String title;

    private String content;

    private String deviceId;

    private String deviceName;

    private String action;

    private Integer readStatus;

    private String channel;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}
