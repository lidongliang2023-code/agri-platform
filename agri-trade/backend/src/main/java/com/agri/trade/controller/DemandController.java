package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.MatchRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/demand")
@RequiredArgsConstructor
public class DemandController {

    private final DemandMapper demandMapper;
    private final MatchRecordMapper matchRecordMapper;

    @GetMapping("/page")
    public ApiResponse<IPage<Demand>> getDemandPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long buyerId,
            @RequestParam(required = false) String demandStatus,
            // 需求列表页要按需求单号、品类、关键词搜。
            // 原先只有 buyerId 与状态两个条件，页面上的搜框输了字点搜索毫无变化
            // （参数名对不上，Spring 直接忽略）。
            @RequestParam(required = false) String demandNo,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword) {
        Page<Demand> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Demand> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Demand::getDelFlag, 0);
        if (buyerId != null) wrapper.eq(Demand::getBuyerId, buyerId);
        if (demandStatus != null) wrapper.eq(Demand::getDemandStatus, demandStatus);
        if (demandNo != null && !demandNo.isEmpty()) wrapper.like(Demand::getDemandNo, demandNo);
        if (categoryId != null) wrapper.eq(Demand::getCategoryId, categoryId);
        if (keyword != null && !keyword.isEmpty()) {
            // 关键词同时匹配需求名称 / 商品名称 / 品种：这三个是买家写需求时最可能被搜的字段。
            // 用 and(...or...) 包一层，否则 or 会把前面的 del_flag / 状态条件一起放开。
            wrapper.and(w -> w.like(Demand::getDemandName, keyword)
                    .or().like(Demand::getProductName, keyword)
                    .or().like(Demand::getVariety, keyword));
        }
        wrapper.orderByDesc(Demand::getCreateTime);
        return ApiResponse.success(demandMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Demand> getDemandById(@PathVariable Long id) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) return ApiResponse.error("需求不存在");
        return ApiResponse.success(demand);
    }

    @PostMapping
    public ApiResponse<Boolean> createDemand(@RequestBody Demand demand) {
        demand.setDemandNo("DM" + System.currentTimeMillis());
        demand.setDelFlag(0);
        // 状态取值必须与系统其余地方一致：列表/详情的状态标签认的是
        // pending / matching / quoted / completed / closed。
        // 原先这里写 "publish"，新建的需求到列表里就成了一个没人认识的灰标签。
        if (demand.getDemandStatus() == null || demand.getDemandStatus().isEmpty()) {
            demand.setDemandStatus("pending");
        }
        // 采购方：表单不该让买家自己填 ID。优先用请求里带的（例如代运营录入），
        // 否则取当前登录用户（平台令牌里的 sub / username）。
        if (demand.getBuyerId() == null) {
            demand.setBuyerId(SecurityUtils.getUserId());
        }
        if (demand.getBuyerName() == null || demand.getBuyerName().isEmpty()) {
            demand.setBuyerName(SecurityUtils.getUsername());
        }
        Date now = new Date();
        if (demand.getPublishTime() == null) {
            demand.setPublishTime(now);
        }
        demand.setCreateTime(now);
        demand.setUpdateTime(now);
        int result = demandMapper.insert(demand);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateDemand(@PathVariable Long id, @RequestBody Demand demand) {
        demand.setId(id);
        demand.setUpdateTime(new Date());
        int result = demandMapper.updateById(demand);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteDemand(@PathVariable Long id) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) return ApiResponse.error("需求不存在");
        demand.setDelFlag(1);
        demand.setUpdateTime(new Date());
        int result = demandMapper.updateById(demand);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/match")
    public ApiResponse<Boolean> matchDemand(@PathVariable Long id) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) return ApiResponse.error("需求不存在");
        
        MatchRecord record = new MatchRecord();
        record.setMatchNo("MT" + System.currentTimeMillis());
        record.setDemandId(id);
        record.setMatchType("demand_to_product");
        record.setMatchScore(new BigDecimal("85.50"));
        record.setCategoryScore(new BigDecimal("90"));
        record.setPriceScore(new BigDecimal("80"));
        record.setDistanceScore(new BigDecimal("85"));
        record.setQualityScore(new BigDecimal("90"));
        record.setMatchReason("品类匹配度高，价格符合预期");
        record.setDelFlag(0);
        record.setCreateTime(new Date());
        
        int result = matchRecordMapper.insert(record);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("匹配失败");
    }

    @GetMapping("/{id}/matches")
    public ApiResponse<List<MatchRecord>> getDemandMatches(@PathVariable Long id) {
        LambdaQueryWrapper<MatchRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MatchRecord::getDemandId, id);
        wrapper.eq(MatchRecord::getDelFlag, 0);
        wrapper.orderByDesc(MatchRecord::getMatchScore);
        return ApiResponse.success(matchRecordMapper.selectList(wrapper));
    }
}
