package com.agri.iot.controller;

import com.agri.common.result.ApiResponse;
import com.agri.iot.service.DeviceCommandService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** 设备侧专用接入：密钥按设备配置，不接受用户端代填执行结果。 */
@RestController
@RequestMapping("/api/v1/iot/device-channel/devices/{deviceId}")
public class DeviceReceiptController {
    private final DeviceCommandService commands;
    private final Map<String,String> keys;
    public DeviceReceiptController(DeviceCommandService commands,
            @Value("${iot.command.device-keys-json:{}}") String json,ObjectMapper mapper) throws Exception {
        this.commands=commands;
        this.keys=mapper.readValue(json,mapper.getTypeFactory().constructMapType(HashMap.class,String.class,String.class));
    }
    private void authenticate(long id,String key) {
        String expected=keys.get(String.valueOf(id));
        if(expected==null||expected.length()<32||key==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),key.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"设备接入凭据无效或未配置");
    }
    /** 接入端需以 commandNo 幂等执行，领取重试返回相同 dispatchToken。 */
    @PostMapping("/commands/claim")
    public ApiResponse<List<Map<String,Object>>> claim(@PathVariable long deviceId,@RequestHeader(value="X-Device-Key",required=false) String key) {
        authenticate(deviceId,key);return ApiResponse.success(commands.claim(deviceId));
    }
    @PostMapping("/commands/{code}/receipt")
    public ApiResponse<Map<String,Object>> receipt(@PathVariable long deviceId,@PathVariable String code,
            @RequestHeader(value="X-Device-Key",required=false) String key,@RequestBody Map<String,String> body) {
        authenticate(deviceId,key);return ApiResponse.success(commands.receipt(deviceId,code,body.get("dispatchToken"),body.getOrDefault("status",""),body.get("result")));
    }
}
