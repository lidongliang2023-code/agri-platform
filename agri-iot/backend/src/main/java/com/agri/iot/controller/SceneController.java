package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.entity.Scene;
import com.agri.iot.service.ISceneService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/scene")
@RequiredArgsConstructor
public class SceneController {

    private final ISceneService sceneService;

    @GetMapping("/list")
    public ApiResponse<List<Scene>> listAll() {
        return ApiResponse.success(sceneService.listAll());
    }

    @GetMapping("/category/{category}")
    public ApiResponse<List<Scene>> listByCategory(@PathVariable String category) {
        return ApiResponse.success(sceneService.listByCategory(category));
    }

    @GetMapping("/active")
    public ApiResponse<List<Scene>> listActive() {
        return ApiResponse.success(sceneService.listActiveScenes());
    }

    @GetMapping("/{id}")
    public ApiResponse<Scene> getDetail(@PathVariable Long id) {
        return ApiResponse.success(sceneService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody Scene scene) {
        sceneService.save(scene);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody Scene scene) {
        sceneService.update(id, scene);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        sceneService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/activate")
    public ApiResponse<Void> activate(@PathVariable Long id) {
        sceneService.activate(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/deactivate")
    public ApiResponse<Void> deactivate(@PathVariable Long id) {
        sceneService.deactivate(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<Void> execute(@PathVariable Long id) {
        sceneService.executeScene(id);
        return ApiResponse.success();
    }
}