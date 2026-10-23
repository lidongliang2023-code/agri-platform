package com.agri.finance.service.impl;

import com.agri.finance.entity.PledgeGoods;
import com.agri.finance.mapper.PledgeGoodsMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PledgeGoodsServiceImpl extends ServiceImpl<PledgeGoodsMapper, PledgeGoods> {

    public PledgeGoods addGoods(PledgeGoods goods) {
        goods.setGoodsCode("PG" + System.currentTimeMillis());
        goods.setStatus("启用");
        goods.setCreatedAt(LocalDateTime.now());
        goods.setUpdatedAt(LocalDateTime.now());
        goods.setDelFlag(0);
        save(goods);
        return goods;
    }

    public PledgeGoods updateGoods(PledgeGoods goods) {
        goods.setUpdatedAt(LocalDateTime.now());
        updateById(goods);
        return goods;
    }

    public void enableGoods(String goodsId) {
        PledgeGoods goods = getById(goodsId);
        if (goods != null) {
            goods.setStatus("启用");
            goods.setUpdatedAt(LocalDateTime.now());
            updateById(goods);
        }
    }

    public void disableGoods(String goodsId) {
        PledgeGoods goods = getById(goodsId);
        if (goods != null) {
            goods.setStatus("禁用");
            goods.setUpdatedAt(LocalDateTime.now());
            updateById(goods);
        }
    }

    public List<PledgeGoods> getEnabledGoods() {
        LambdaQueryWrapper<PledgeGoods> query = new LambdaQueryWrapper<>();
        query.eq(PledgeGoods::getStatus, "启用")
             .eq(PledgeGoods::getDelFlag, 0);
        return list(query);
    }

    public List<PledgeGoods> getGoodsByCategory(String category) {
        LambdaQueryWrapper<PledgeGoods> query = new LambdaQueryWrapper<>();
        query.eq(PledgeGoods::getCategory, category)
             .eq(PledgeGoods::getDelFlag, 0);
        return list(query);
    }
}