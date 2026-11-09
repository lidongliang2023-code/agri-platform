package com.agri.iot.controller;

import com.agri.iot.service.FirmwareStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.*;
import org.springframework.core.io.FileSystemResource;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/iot/gateway-channel/firmware")
public class FirmwareDownloadController {
    private final FirmwareStorageService storage;
    private final JdbcTemplate jdbc;
    private final Map<String,String> keys;
    public FirmwareDownloadController(FirmwareStorageService storage,JdbcTemplate jdbc,
            @Value("${iot.command.gateway-keys-json:{}}") String json,ObjectMapper mapper)throws Exception{
        this.storage=storage;this.jdbc=jdbc;
        keys=mapper.readValue(json,mapper.getTypeFactory().constructMapType(HashMap.class,String.class,String.class));
    }
    @GetMapping("/{hash}")
    public ResponseEntity<FileSystemResource> download(@PathVariable String hash,
            @RequestHeader(value="X-Gateway-Id",required=false) Long gatewayId,
            @RequestHeader(value="X-Gateway-Key",required=false) String key){
        String expected=keys.get(String.valueOf(gatewayId));
        if(expected==null||expected.length()<32||key==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),key.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"网关接入凭据无效");
        if(!hash.matches("[a-f0-9]{64}"))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var rows=jdbc.queryForList("SELECT r.firmware_url,f.file_size_bytes FROM iot_ota_receipt r JOIN iot_ota_task t ON t.id=r.task_id JOIN iot_firmware f ON f.id=t.firmware_id WHERE r.gateway_id=? AND r.sha256_text=? AND f.sha256_text=r.sha256_text AND f.package_url=r.firmware_url AND r.command_status IN ('SENT','RUNNING') AND r.expires_at>?",gatewayId,hash,java.time.LocalDateTime.now().toString());
        for(var row:rows){
            String url=Objects.toString(row.get("firmware_url"),"");
            if(storage.managed(url)){
                long size=Long.parseLong(row.get("file_size_bytes").toString());
                var path=storage.verify(url,hash,size);
                return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).contentLength(size)
                    .header(HttpHeaders.CACHE_CONTROL,"no-store")
                    .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=firmware-"+hash+".bin")
                    .header("X-Content-Type-Options","nosniff").body(new FileSystemResource(path));
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,"当前网关没有已领取且有效的对应升级指令");
    }
}
