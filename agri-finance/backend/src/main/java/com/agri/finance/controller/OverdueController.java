package com.agri.finance.controller;

import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.service.impl.OverdueRecordServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/overdue")
public class OverdueController {

    private final OverdueRecordServiceImpl overdueRecordService;

    public OverdueController(OverdueRecordServiceImpl overdueRecordService) {
        this.overdueRecordService = overdueRecordService;
    }

    @GetMapping("/list")
    public Map<String, Object> getOverdueRecords(@RequestParam(defaultValue = "") String status, @RequestParam(defaultValue = "") String stage) {
        LambdaQueryWrapper<OverdueRecord> query = new LambdaQueryWrapper<>();
        query.eq(OverdueRecord::getDelFlag, 0);
        if (!status.isEmpty()) {
            query.eq(OverdueRecord::getStatus, status);
        }
        if (!stage.isEmpty()) {
            query.eq(OverdueRecord::getOverdueStage, stage);
        }
        var list = overdueRecordService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getOverdueRecord(@PathVariable String id) {
        OverdueRecord record = overdueRecordService.getById(id);
        return Map.of("code", 200, "message", "success", "data", record);
    }

    @PostMapping("/assign")
    public Map<String, Object> assignCollector(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        String collectorId = request.get("collectorId");
        String collectorName = request.get("collectorName");
        OverdueRecord record = overdueRecordService.assignCollector(id, collectorId, collectorName);
        return Map.of("code", 200, "message", "success", "data", record);
    }

    @PostMapping("/paid")
    public Map<String, Object> markPaid(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        OverdueRecord record = overdueRecordService.markPaid(id);
        return Map.of("code", 200, "message", "success", "data", record);
    }
}