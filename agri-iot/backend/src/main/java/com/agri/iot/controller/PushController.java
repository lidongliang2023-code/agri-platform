
package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.dto.PushConfigUpdateDTO;
import com.agri.iot.service.IPushService;
import com.agri.iot.vo.PushConfigVO;
import com.agri.iot.vo.PushNotificationVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/push")
@RequiredArgsConstructor
public class PushController {

    private final IPushService pushService;

    @GetMapping("/config")
    public ApiResponse<PushConfigVO> getConfig() {
        return ApiResponse.success(pushService.getConfig());
    }

    @PutMapping("/config")
    public ApiResponse<Void> updateConfig(@RequestBody PushConfigUpdateDTO dto) {
        pushService.updateConfig(dto);
        return ApiResponse.success();
    }

    @GetMapping("/history")
    public ApiResponse<List<PushNotificationVO>> getHistory(@RequestParam(required = false) Integer readStatus) {
        return ApiResponse.success(pushService.getNotificationList(readStatus));
    }

    @PostMapping("/mark-read")
    public ApiResponse<Void> markRead(@RequestParam String notificationId) {
        pushService.markRead(notificationId);
        return ApiResponse.success();
    }

    @PostMapping("/mark-all-read")
    public ApiResponse<Void> markAllRead() {
        pushService.markAllRead();
        return ApiResponse.success();
    }
}
