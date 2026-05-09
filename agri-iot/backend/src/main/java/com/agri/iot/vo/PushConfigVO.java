
package com.agri.iot.vo;

import lombok.Data;

@Data
public class PushConfigVO {

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
