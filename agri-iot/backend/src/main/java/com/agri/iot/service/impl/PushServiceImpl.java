
package com.agri.iot.service.impl;

import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.PushConfigUpdateDTO;
import com.agri.iot.entity.PushConfig;
import com.agri.iot.entity.PushNotification;
import com.agri.iot.mapper.PushMapper;
import com.agri.iot.service.IPushService;
import com.agri.iot.vo.PushConfigVO;
import com.agri.iot.vo.PushNotificationVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PushServiceImpl implements IPushService {

    private final PushMapper pushMapper;

    @Override
    public PushConfigVO getConfig() {
        Long userId = SecurityUtils.getUserId();
        String userIdStr = userId != null ? userId.toString() : null;
        PushConfig config = pushMapper.selectConfigByUserId(userIdStr);
        if (config == null) {
            config = createDefaultConfig(userIdStr);
            pushMapper.insertConfig(config);
        }
        return BeanCopyUtils.copy(config, PushConfigVO.class);
    }

    @Override
    @Transactional
    public void updateConfig(PushConfigUpdateDTO dto) {
        Long userId = SecurityUtils.getUserId();
        String userIdStr = userId != null ? userId.toString() : null;
        PushConfig config = pushMapper.selectConfigByUserId(userIdStr);
        if (config == null) {
            config = new PushConfig();
            config.setUserId(userIdStr);
            config.setTenantId(SecurityUtils.getTenantId());
            config.setCreateBy(SecurityUtils.getUsername());
            BeanCopyUtils.copyProperties(dto, config);
            pushMapper.insertConfig(config);
        } else {
            BeanCopyUtils.copyProperties(dto, config);
            config.setUpdateBy(SecurityUtils.getUsername());
            pushMapper.updateConfig(config);
        }
    }

    @Override
    public List<PushNotificationVO> getNotificationList(Integer readStatus) {
        Long userId = SecurityUtils.getUserId();
        String userIdStr = userId != null ? userId.toString() : null;
        return pushMapper.selectNotificationList(userIdStr, readStatus);
    }

    @Override
    @Transactional
    public void markRead(String notificationId) {
        Long userId = SecurityUtils.getUserId();
        String userIdStr = userId != null ? userId.toString() : null;
        pushMapper.updateReadStatus(userIdStr, notificationId);
    }

    @Override
    @Transactional
    public void markAllRead() {
        Long userId = SecurityUtils.getUserId();
        String userIdStr = userId != null ? userId.toString() : null;
        pushMapper.markAllRead(userIdStr);
    }

    @Override
    @Transactional
    public void sendNotification(String type, String level, String title, String content, String deviceId, String deviceName) {
        PushNotification notification = new PushNotification();
        notification.setNotificationId("NOTIFY" + System.currentTimeMillis() + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        notification.setType(type);
        notification.setLevel(level);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setDeviceId(deviceId);
        notification.setDeviceName(deviceName);
        notification.setAction("/device/detail?deviceId=" + deviceId);
        Long userId = SecurityUtils.getUserId();
        notification.setUserId(userId != null ? userId.toString() : null);
        notification.setTenantId(SecurityUtils.getTenantId());
        notification.setReadStatus(0);
        notification.setCreateBy("SYSTEM");
        pushMapper.insertNotification(notification);
    }

    private PushConfig createDefaultConfig(String userId) {
        PushConfig config = new PushConfig();
        config.setUserId(userId);
        config.setTenantId(SecurityUtils.getTenantId());
        config.setCreateBy(SecurityUtils.getUsername());
        config.setPushEnabled(1);
        config.setAllDayPush(1);
        config.setUrgentAlert(1);
        config.setNormalAlert(1);
        config.setDeviceOffline(1);
        config.setControlResult(1);
        config.setSystemNotice(1);
        config.setDataException(1);
        config.setScheduledReminder(1);
        config.setUrgentSound(1);
        config.setOtherSound(1);
        config.setSilentEnabled(0);
        return config;
    }
}
