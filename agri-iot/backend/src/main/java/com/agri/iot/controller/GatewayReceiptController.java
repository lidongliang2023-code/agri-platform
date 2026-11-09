package com.agri.iot.controller;

import com.agri.common.result.ApiResponse;
import com.agri.iot.service.GatewayCommandService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** 网关侧专用接入：密钥按网关配置，不接受用户端代填执行结果。 */
@RestController
@RequestMapping("/api/v1/iot/gateway-channel/gateways/{gatewayId}")
public class GatewayReceiptController {
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.OtaCommandService ota;
    private final GatewayCommandService commands;
    private final Map<String,String> keys;
    public GatewayReceiptController(GatewayCommandService commands,
            @Value("${iot.command.gateway-keys-json:{}}") String json,ObjectMapper mapper) throws Exception {
        this.commands=commands;
        this.keys=mapper.readValue(json,mapper.getTypeFactory().constructMapType(HashMap.class,String.class,String.class));
    }
    private void authenticate(long id,String key) {
        String expected=keys.get(String.valueOf(id));
        if(expected==null||expected.length()<32||key==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),key.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"网关接入凭据无效或未配置");
    }
    /** 接入端需以 commandNo 幂等执行，领取重试返回相同 dispatchToken。 */
    @PostMapping("/commands/claim")
    public ApiResponse<List<Map<String,Object>>> claim(@PathVariable long gatewayId,@RequestHeader(value="X-Gateway-Key",required=false) String key) {
        authenticate(gatewayId,key);return ApiResponse.success(commands.claim(gatewayId));
    }
    @PostMapping("/commands/{code}/receipt")
    public ApiResponse<Map<String,Object>> receipt(@PathVariable long gatewayId,@PathVariable String code,
            @RequestHeader(value="X-Gateway-Key",required=false) String key,@RequestBody Map<String,String> body) {
        authenticate(gatewayId,key);return ApiResponse.success(commands.receipt(gatewayId,code,body.get("dispatchToken"),body.getOrDefault("status",""),body.get("result")));
    }
    @PostMapping("/ota/claim")
    public ApiResponse<List<Map<String,Object>>> claimOta(@PathVariable long gatewayId,@RequestHeader(value="X-Gateway-Key",required=false) String key){authenticate(gatewayId,key);return ApiResponse.success(ota.claim(gatewayId));}
    @PostMapping("/ota/{code}/receipt")
    public ApiResponse<Map<String,Object>> receiptOta(@PathVariable long gatewayId,@PathVariable String code,@RequestHeader(value="X-Gateway-Key",required=false) String key,@RequestBody Map<String,String> body){authenticate(gatewayId,key);return ApiResponse.success(ota.receipt(gatewayId,code,body));}
}
