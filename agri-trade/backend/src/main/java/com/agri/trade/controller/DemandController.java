package com.agri.iot.controller.trade;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.entity.trade.Demand;
import com.agri.iot.entity.trade.MatchRecord;
import com.agri.iot.mapper.trade.DemandMapper;
import com.agri.iot.mapper.trade.MatchRecordMapper;
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
            @RequestParam(required = false) String demandStatus) {
        Page<Demand> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Demand> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Demand::getDelFlag, 0);
        if (buyerId != null) wrapper.eq(Demand::getBuyerId, buyerId);
        if (demandStatus != null) wrapper.eq(Demand::getDemandStatus, demandStatus);
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
        demand.setDemandStatus("publish");
        demand.setCreateTime(new Date());
        demand.setUpdateTime(new Date());
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