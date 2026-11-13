package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.ContentImageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/** 写入走运营RBAC；随机地址只读图片可用于正文img，不暴露目录或原文件名。 */
@RestController
public class ContentImageController {
    private final ContentImageService images;
    public ContentImageController(ContentImageService images) { this.images = images; }

    @PostMapping(value = "/api/v1/production/admin/knowledge/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ContentImageService.StoredImage> upload(@RequestPart("file") MultipartFile file) {
        return ApiResponse.success(images.store(file));
    }

    @GetMapping("/api/v1/production/knowledge-images/{name}")
    public ResponseEntity<Resource> image(@PathVariable String name) {
        Path path = images.requireImage(name);
        return ResponseEntity.ok()
                .contentType(name.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic().immutable())
                .body(new FileSystemResource(path));
    }
}
