
package com.agri.iot.service;

import com.agri.iot.dto.PushConfigUpdateDTO;
import com.agri.iot.vo.PushConfigVO;
import com.agri.iot.vo.PushNotificationVO;

import java.util.List;

public interface IPushService {

    PushConfigVO getConfig();

    void updateConfig(PushConfigUpdateDTO dto);

    List<PushNotificationVO> getNotificationList(Integer readStatus);

    void markRead(String notificationId);

    void markAllRead();

    void sendNotification(String type, String level, String title, String content, String deviceId, String deviceName);
}
