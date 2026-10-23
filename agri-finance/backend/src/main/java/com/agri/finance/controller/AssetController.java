package com.agri.finance.controller;

import com.agri.finance.entity.Asset;
import com.agri.finance.service.impl.AssetServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/asset")
public class AssetController {

    @Autowired
    private AssetServiceImpl assetService;

    @PostMapping("/publish")
    public Map<String, Object> publishAsset(@RequestBody Asset asset) {
        Asset result = assetService.publishAsset(asset);
        return Map.of("code", 200, "message", "发布成功", "data", result);
    }

    @GetMapping("/available")
    public Map<String, Object> getAvailableAssets() {
        List<Asset> assets = assetService.getAvailableAssets();
        return Map.of("code", 200, "message", "success", "data", assets);
    }

    @GetMapping("/provider/{providerId}")
    public Map<String, Object> getAssetsByProvider(@PathVariable String providerId) {
        List<Asset> assets = assetService.getAssetsByProvider(providerId);
        return Map.of("code", 200, "message", "success", "data", assets);
    }

    @GetMapping("/{assetId}")
    public Map<String, Object> getAssetDetail(@PathVariable String assetId) {
        Asset asset = assetService.getAssetDetail(assetId);
        return Map.of("code", 200, "message", "success", "data", asset);
    }

    @PostMapping("/invest/{assetId}")
    public Map<String, Object> invest(@PathVariable String assetId, @RequestParam BigDecimal amount) {
        Asset asset = assetService.invest(assetId, amount);
        return Map.of("code", 200, "message", "投资成功", "data", asset);
    }

    @PostMapping("/offline/{assetId}")
    public Map<String, Object> offlineAsset(@PathVariable String assetId) {
        assetService.offlineAsset(assetId);
        return Map.of("code", 200, "message", "已下线");
    }
}