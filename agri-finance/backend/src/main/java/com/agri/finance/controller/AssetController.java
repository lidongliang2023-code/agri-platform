package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Asset;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.AssetServiceImpl;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/asset")
@OperatorOnly("finance:fund")
public class AssetController {

    private final AssetServiceImpl assetService;
    private final FinanceIdentityService identityService;

    public AssetController(AssetServiceImpl assetService, FinanceIdentityService identityService) {
        this.assetService = assetService;
        this.identityService = identityService;
    }

    @PostMapping("/publish")
    public Map<String, Object> publishAsset(@RequestBody Asset asset) {
        if (asset == null) {
            return Map.of("code", 400, "message", "缺少资产信息", "data", "");
        }
        // 发布方就是当前登录的资金机构，不接受请求体里的 providerId
        asset.setProviderId(identityService.currentProviderId());
        Asset result = assetService.publishAsset(asset);
        return Map.of("code", 200, "message", "发布成功", "data", result);
    }

    @GetMapping("/available")
    public Map<String, Object> getAvailableAssets() {
        List<Asset> assets = assetService.getAvailableAssets();
        return Map.of("code", 200, "message", "success", "data", assets);
    }

    /** 本机构名下的资产。 */
    @GetMapping("/mine")
    public Map<String, Object> getMyAssets() {
        List<Asset> assets = assetService.getAssetsByProvider(identityService.currentProviderId());
        return Map.of("code", 200, "message", "success", "data", assets);
    }

    @GetMapping("/{assetId}")
    public Map<String, Object> getAssetDetail(@PathVariable String assetId) {
        Asset asset = assetService.getAssetDetail(assetId);
        if (asset == null) {
            return Map.of("code", 404, "message", "资产不存在", "data", "");
        }
        return Map.of("code", 200, "message", "success", "data", assetService.assetView(asset));
    }

    /**
     * 下线资产。
     *
     * <p>原先还有一个 {@code POST /asset/invest/{assetId}} 只改额度、不校验机构额度与账户余额，
     * 是与 {@code /investment/subscribe} 并存的第二条配置资金通道（能绕过额度控制），
     * 已删除，配置资金只走 subscribe 一条路。</p>
     */
    @PostMapping("/offline/{assetId}")
    public Map<String, Object> offlineAsset(@PathVariable String assetId) {
        Asset asset = assetService.getAssetDetail(assetId);
        if (asset == null) {
            return Map.of("code", 404, "message", "资产不存在", "data", "");
        }
        if (!identityService.currentProviderId().equals(asset.getProviderId())
                && !identityService.hasPermission("finance:admin")) {
            return Map.of("code", 403, "message", "只能下线本机构发布的资产", "data", "");
        }
        assetService.offlineAsset(assetId);
        return Map.of("code", 200, "message", "已下线", "data", "");
    }
}
