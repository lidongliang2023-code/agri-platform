package com.agri.finance.controller;

import com.agri.finance.entity.PledgeGoods;
import com.agri.finance.service.impl.PledgeGoodsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/pledge-goods")
public class PledgeGoodsController {

    @Autowired
    private PledgeGoodsServiceImpl pledgeGoodsService;

    @PostMapping("/add")
    public Map<String, Object> addGoods(@RequestBody PledgeGoods goods) {
        PledgeGoods result = pledgeGoodsService.addGoods(goods);
        return Map.of("code", 200, "message", "添加成功", "data", result);
    }

    @PutMapping("/update")
    public Map<String, Object> updateGoods(@RequestBody PledgeGoods goods) {
        PledgeGoods result = pledgeGoodsService.updateGoods(goods);
        return Map.of("code", 200, "message", "更新成功", "data", result);
    }

    @PostMapping("/enable/{goodsId}")
    public Map<String, Object> enableGoods(@PathVariable String goodsId) {
        pledgeGoodsService.enableGoods(goodsId);
        return Map.of("code", 200, "message", "已启用");
    }

    @PostMapping("/disable/{goodsId}")
    public Map<String, Object> disableGoods(@PathVariable String goodsId) {
        pledgeGoodsService.disableGoods(goodsId);
        return Map.of("code", 200, "message", "已禁用");
    }

    @GetMapping("/enabled")
    public Map<String, Object> getEnabledGoods() {
        List<PledgeGoods> goods = pledgeGoodsService.getEnabledGoods();
        return Map.of("code", 200, "message", "success", "data", goods);
    }

    @GetMapping("/category/{category}")
    public Map<String, Object> getGoodsByCategory(@PathVariable String category) {
        List<PledgeGoods> goods = pledgeGoodsService.getGoodsByCategory(category);
        return Map.of("code", 200, "message", "success", "data", goods);
    }

    @GetMapping("/list")
    public Map<String, Object> getAllGoods() {
        List<PledgeGoods> goods = pledgeGoodsService.list();
        return Map.of("code", 200, "message", "success", "data", goods);
    }
}