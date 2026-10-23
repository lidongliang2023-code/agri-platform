package com.agri.finance.service.impl;

import com.agri.finance.entity.FundProvider;
import com.agri.finance.mapper.FundProviderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FundProviderServiceImpl extends ServiceImpl<FundProviderMapper, FundProvider> {

    public FundProvider register(FundProvider provider) {
        provider.setProviderNo("FP" + System.currentTimeMillis());
        provider.setReviewStatus("待审核");
        provider.setCreatedAt(LocalDateTime.now());
        provider.setUpdatedAt(LocalDateTime.now());
        provider.setDelFlag(0);
        save(provider);
        return provider;
    }

    public FundProvider approve(String id, String reviewerId, String opinion) {
        FundProvider provider = getById(id);
        if (provider != null) {
            provider.setReviewStatus("已通过");
            provider.setStatus("正常");
            provider.setReviewOpinion(opinion);
            provider.setReviewerId(reviewerId);
            provider.setReviewTime(LocalDateTime.now());
            provider.setUpdatedAt(LocalDateTime.now());
            updateById(provider);
        }
        return provider;
    }

    public FundProvider reject(String id, String reviewerId, String opinion) {
        FundProvider provider = getById(id);
        if (provider != null) {
            provider.setReviewStatus("已拒绝");
            provider.setStatus("禁用");
            provider.setReviewOpinion(opinion);
            provider.setReviewerId(reviewerId);
            provider.setReviewTime(LocalDateTime.now());
            provider.setUpdatedAt(LocalDateTime.now());
            updateById(provider);
        }
        return provider;
    }

    public List<FundProvider> getPendingReview() {
        LambdaQueryWrapper<FundProvider> query = new LambdaQueryWrapper<>();
        query.eq(FundProvider::getReviewStatus, "待审核")
             .eq(FundProvider::getDelFlag, 0);
        return list(query);
    }

    public List<FundProvider> getActiveProviders() {
        LambdaQueryWrapper<FundProvider> query = new LambdaQueryWrapper<>();
        query.eq(FundProvider::getStatus, "正常")
             .eq(FundProvider::getDelFlag, 0);
        return list(query);
    }
}