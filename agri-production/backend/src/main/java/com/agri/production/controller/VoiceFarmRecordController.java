package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.dto.VoiceRecordDraft;
import com.agri.production.service.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/production/voice-records")
public class VoiceFarmRecordController {
    private final VoiceFarmRecordService service;
    public VoiceFarmRecordController(VoiceFarmRecordService service){this.service=service;}
    private String tenant(){return TenantContextService.currentTenantId();}
    public record Edit(int revision,String transcript,VoiceRecordDraft draft,String reason){}
    public record Action(int revision,String reason,boolean confirmed,boolean abnormalConfirmed,Long existingUsageId){}
    @GetMapping("/context") public ApiResponse<Map<String,Object>> context(@RequestParam String farmId){return ApiResponse.success(service.context(tenant(),farmId));}
    @GetMapping public ApiResponse<List<Map<String,Object>>> list(@RequestParam String farmId){return ApiResponse.success(service.list(tenant(),farmId));}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Map<String,Object>> create(@RequestParam String farmId,@RequestParam String requestId,@RequestParam(defaultValue="") String transcript,@RequestPart(required=false) MultipartFile audio) throws java.io.IOException {
        return ApiResponse.success(service.create(tenant(),farmId,requestId,transcript,audio==null?null:audio.getBytes()));
    }
    @GetMapping("/export") public ApiResponse<List<Map<String,Object>>> export(@RequestParam String farmId){return ApiResponse.success(service.export(tenant(),farmId));}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable String id){return ApiResponse.success(service.detail(tenant(),id));}
    @GetMapping("/{id}/audio") public ResponseEntity<byte[]> audio(@PathVariable String id){var a=service.audio(tenant(),id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(a.type())).header("Cache-Control","no-store").header("X-Content-Type-Options","nosniff").body(a.bytes());}
    @PutMapping("/{id}") public ApiResponse<Map<String,Object>> save(@PathVariable String id,@RequestBody Edit e){return ApiResponse.success(service.save(tenant(),id,e.revision(),e.transcript(),e.draft(),e.reason()));}
    @PostMapping("/{id}/transcribe") public ApiResponse<Map<String,Object>> transcribe(@PathVariable String id,@RequestBody Action a){return ApiResponse.success(service.transcribe(tenant(),id,a.revision()));}
    @PostMapping("/{id}/extract") public ApiResponse<Map<String,Object>> extract(@PathVariable String id,@RequestBody Action a){return ApiResponse.success(service.extract(tenant(),id,a.revision()));}
    @PostMapping("/{id}/review") public ApiResponse<Map<String,Object>> review(@PathVariable String id,@RequestBody Action a){return ApiResponse.success(service.review(tenant(),id,a.revision(),a.reason()));}
    @PostMapping("/{id}/archive") public ApiResponse<Map<String,Object>> archive(@PathVariable String id,@RequestBody Action a){return ApiResponse.success(service.archive(tenant(),id,a.revision(),a.reason(),a.confirmed(),a.abnormalConfirmed(),a.existingUsageId()));}
    @PostMapping("/{id}/void") public ApiResponse<Map<String,Object>> voidDraft(@PathVariable String id,@RequestBody Action a){return ApiResponse.success(service.voidDraft(tenant(),id,a.revision(),a.reason()));}
}
