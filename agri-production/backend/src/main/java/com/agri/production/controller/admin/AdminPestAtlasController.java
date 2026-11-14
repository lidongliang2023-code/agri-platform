package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.PestAtlasService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** 与现有知识文章共用运营端鉴权，图谱只维护结构化关系。 */
@RestController
@RequestMapping("/api/v1/production/admin/knowledge/pest-atlas")
public class AdminPestAtlasController {
    private final PestAtlasService atlas;
    public AdminPestAtlasController(PestAtlasService atlas) { this.atlas=atlas; }
    @GetMapping public ApiResponse<Map<String,Object>> list(@RequestParam(required=false) String keyword,@RequestParam(required=false) String status,
        @RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="10") int pageSize) {
        return ApiResponse.success(atlas.list(keyword,status,pageNum,pageSize));
    }
    @GetMapping("/search") public ApiResponse<Map<String,Object>> search(@RequestParam String cropName,@RequestParam String symptoms,@RequestParam(required=false) String growthStage) {
        return ApiResponse.success(atlas.retrieve(cropName,symptoms,growthStage));
    }
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> get(@PathVariable String id) { return ApiResponse.success(atlas.get(id)); }
    @PostMapping public ApiResponse<Map<String,Object>> create(@RequestBody Map<String,Object> body) { return ApiResponse.success(atlas.save(null,body)); }
    @PutMapping("/{id}") public ApiResponse<Map<String,Object>> update(@PathVariable String id,@RequestBody Map<String,Object> body) { return ApiResponse.success(atlas.save(id,body)); }
    @PatchMapping("/{id}/publish") public ApiResponse<Map<String,Object>> publish(@PathVariable String id,@RequestBody Map<String,Object> body) {
        if(!(body.get("revision") instanceof Number version) || !(body.get("published") instanceof Boolean published)) throw new BusinessException(400,"缺少版本号或发布状态");
        return ApiResponse.success(atlas.publish(id,version.intValue(),published));
    }
}
