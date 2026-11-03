package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.PledgeGoods;
import com.agri.finance.service.impl.PledgeGoodsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 质押物字典（折算率上限、最长期限、估值口径）。
 *
 * <p>整类原来都挂 {@code finance:admin}，融资方读不到字典：开仓单时选不了品种、
 * 也看不到"这批货最高能押几成"。写操作仍然是运营的事，
 * 只有 {@code /enabled} 这条只读、且只回启用中的品种，放开给融资方。</p>
 */
@RestController
@RequestMapping("/api/v1/pledge-goods")
public class PledgeGoodsController {

    @Autowired
    private PledgeGoodsServiceImpl pledgeGoodsService;

    @PostMapping("/add")
    @OperatorOnly("finance:admin")
    public Map<String, Object> addGoods(@RequestBody PledgeGoods goods) {
        PledgeGoods result = pledgeGoodsService.addGoods(goods);
        return Map.of("code", 200, "message", "添加成功", "data", result);
    }

    @PutMapping("/update")
    @OperatorOnly("finance:admin")
    public Map<String, Object> updateGoods(@RequestBody PledgeGoods goods) {
        PledgeGoods result = pledgeGoodsService.updateGoods(goods);
        return Map.of("code", 200, "message", "更新成功", "data", result);
    }

    @PostMapping("/enable/{goodsId}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> enableGoods(@PathVariable String goodsId) {
        pledgeGoodsService.enableGoods(goodsId);
        return Map.of("code", 200, "message", "已启用");
    }

    @PostMapping("/disable/{goodsId}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> disableGoods(@PathVariable String goodsId) {
        pledgeGoodsService.disableGoods(goodsId);
        return Map.of("code", 200, "message", "已禁用");
    }

    /** 启用中的质押物：融资方开仓单时的可选品种（含折算率上限）。 */
    @GetMapping("/enabled")
    public Map<String, Object> getEnabledGoods() {
        List<PledgeGoods> goods = pledgeGoodsService.getEnabledGoods();
        return Map.of("code", 200, "message", "success", "data", goods);
    }

    @GetMapping("/category/{category}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> getGoodsByCategory(@PathVariable String category) {
        List<PledgeGoods> goods = pledgeGoodsService.getGoodsByCategory(category);
        return Map.of("code", 200, "message", "success", "data", goods);
    }

    /** 全量字典（含已停用的），运营维护页用。 */
    @GetMapping("/list")
    @OperatorOnly("finance:admin")
    public Map<String, Object> getAllGoods() {
        List<PledgeGoods> goods = pledgeGoodsService.list();
        return Map.of("code", 200, "message", "success", "data", goods);
    }
}
