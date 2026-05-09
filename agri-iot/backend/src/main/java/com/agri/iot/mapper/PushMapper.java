
package com.agri.iot.mapper;

import com.agri.iot.entity.PushConfig;
import com.agri.iot.entity.PushNotification;
import com.agri.iot.vo.PushNotificationVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PushMapper {

    PushConfig selectConfigByUserId(@Param("userId") String userId);

    void insertConfig(PushConfig config);

    void updateConfig(PushConfig config);

    List<PushNotificationVO> selectNotificationList(@Param("userId") String userId, @Param("readStatus") Integer readStatus);

    void insertNotification(PushNotification notification);

    void updateReadStatus(@Param("userId") String userId, @Param("notificationId") String notificationId);

    void markAllRead(@Param("userId") String userId);
}
