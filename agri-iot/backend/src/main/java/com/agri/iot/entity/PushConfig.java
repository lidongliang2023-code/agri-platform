
package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_push_config")
public class PushConfig extends BaseEntity {

    private String userId;

    private Integer pushEnabled;

    private Integer allDayPush;

    private String startHour;

    private String endHour;

    private Integer urgentAlert;

    private Integer normalAlert;

    private Integer deviceOffline;

    private Integer controlResult;

    private Integer systemNotice;

    private Integer dataException;

    private Integer scheduledReminder;

    private Integer urgentSound;

    private Integer otherSound;

    private Integer silentEnabled;

    private String silentStartHour;

    private String silentEndHour;
}
