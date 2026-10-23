package com.agri.finance.service.impl;

import com.agri.finance.entity.Asset;
import com.agri.finance.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AssetServiceImpl extends ServiceImpl<AssetMapper, Asset> {

    public Asset publishAsset(Asset asset) {
        asset.setAssetNo("AST" + System.currentTimeMillis());
        asset.setStatus("可投资");
        asset.setAvailableAmount(asset.getAmount());
        asset.setInvestedAmount(BigDecimal.ZERO);
        asset.setPublishTime(LocalDateTime.now());
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        asset.setDelFlag(0);
        save(asset);
        return asset;
    }

    public List<Asset> getAvailableAssets() {
        LambdaQueryWrapper<Asset> query = new LambdaQueryWrapper<>();
        query.eq(Asset::getStatus, "可投资")
             .eq(Asset::getDelFlag, 0)
             .orderByDesc(Asset::getPublishTime);
        return list(query);
    }

    public List<Asset> getAssetsByProvider(String providerId) {
        LambdaQueryWrapper<Asset> query = new LambdaQueryWrapper<>();
        query.eq(Asset::getProviderId, providerId)
             .eq(Asset::getDelFlag, 0)
             .orderByDesc(Asset::getCreatedAt);
        return list(query);
    }

    public Asset getAssetDetail(String assetId) {
        return getById(assetId);
    }

    public Asset invest(String assetId, BigDecimal amount) {
        Asset asset = getById(assetId);
        if (asset != null && asset.getAvailableAmount().compareTo(amount) >= 0) {
            asset.setInvestedAmount(asset.getInvestedAmount().add(amount));
            asset.setAvailableAmount(asset.getAvailableAmount().subtract(amount));
            if (asset.getAvailableAmount().compareTo(BigDecimal.ZERO) == 0) {
                asset.setStatus("已售罄");
            }
            asset.setUpdatedAt(LocalDateTime.now());
            updateById(asset);
        }
        return asset;
    }

    public void offlineAsset(String assetId) {
        Asset asset = getById(assetId);
        if (asset != null) {
            asset.setStatus("已下线");
            asset.setUpdatedAt(LocalDateTime.now());
            updateById(asset);
        }
    }
}