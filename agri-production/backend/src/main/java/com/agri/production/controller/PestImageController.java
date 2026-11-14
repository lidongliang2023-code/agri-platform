package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.PestImageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class PestImageController {
    private final PestImageService images;
    public PestImageController(PestImageService images) { this.images = images; }

    @GetMapping("/api/v1/production/admin/knowledge/pest-images")
    public ApiResponse<List<Map<String,Object>>> list(@RequestParam(required=false) String atlasId, @RequestParam(required=false) String status) {
        return ApiResponse.success(images.list(atlasId, status));
    }

    @PostMapping(value="/api/v1/production/admin/knowledge/pest-images", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PestImageService.StoredSample> create(@RequestPart("file") MultipartFile file,
            @RequestParam String atlasId, @RequestParam int atlasRevision, @RequestParam String source,
            @RequestParam String sourceVersion, @RequestParam String sourceRef, @RequestParam(required=false, defaultValue="") String note) {
        return ApiResponse.success(images.create(file, atlasId, atlasRevision, source, sourceVersion, sourceRef, note));
    }

    @PatchMapping("/api/v1/production/admin/knowledge/pest-images/{id}/publish")
    public ApiResponse<Map<String,Object>> publish(@PathVariable String id, @RequestBody Map<String,Object> body) {
        return ApiResponse.success(images.publish(id, Boolean.TRUE.equals(body.get("published"))));
    }

    @GetMapping("/api/v1/production/pest-images/{name}")
    public ResponseEntity<Resource> image(@PathVariable String name) {
        Path path = images.requireImage(name);
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(type).header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic().immutable())
                .body(new FileSystemResource(path));
    }
}
