
package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_push_notification")
public class PushNotification extends BaseEntity {

    private String notificationId;

    private String type;

    private String level;

    private String title;

    private String content;

    private String deviceId;

    private String deviceName;

    private String action;

    private String userId;

    private Integer readStatus;

    private String channel;
}
