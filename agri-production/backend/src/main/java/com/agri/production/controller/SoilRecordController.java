package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.SoilRecord;
import com.agri.production.service.ISoilRecordService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/production/soil")
@RequiredArgsConstructor
public class SoilRecordController {

    private final ISoilRecordService soilRecordService;

    @GetMapping("/page")
    public ApiResponse<IPage<SoilRecord>> getPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String healthLevel) {
        Page<SoilRecord> page = new Page<>(pageNum, pageSize);
        IPage<SoilRecord> result = soilRecordService.queryPage(page, plotId, healthLevel);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<List<SoilRecord>> getList(
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String healthLevel) {
        List<SoilRecord> records;
        if (plotId != null) {
            records = soilRecordService.getRecordsByPlotId(plotId);
        } else if (healthLevel != null && !healthLevel.isEmpty()) {
            records = soilRecordService.getRecordsByHealthLevel(healthLevel);
        } else {
            records = soilRecordService.list();
        }
        return ApiResponse.success(records);
    }

    @GetMapping("/{id}")
    public ApiResponse<SoilRecord> getById(@PathVariable Long id) {
        SoilRecord record = soilRecordService.getById(id);
        if (record == null) {
            return ApiResponse.error("土壤记录不存在");
        }
        return ApiResponse.success(record);
    }

    @GetMapping("/plot/{plotId}/latest")
    public ApiResponse<SoilRecord> getLatestByPlotId(@PathVariable Long plotId) {
        SoilRecord record = soilRecordService.getLatestRecord(plotId);
        if (record == null) {
            return ApiResponse.error("没有找到土壤记录");
        }
        return ApiResponse.success(record);
    }

    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody SoilRecord record) {
        record.setDelFlag(0);
        record.setCreateTime(new Date());
        record.setUpdateTime(new Date());
        boolean success = soilRecordService.save(record);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody SoilRecord record) {
        SoilRecord existing = soilRecordService.getById(id);
        if (existing == null) {
            return ApiResponse.error("土壤记录不存在");
        }
        record.setId(id);
        record.setUpdateTime(new Date());
        boolean success = soilRecordService.updateById(record);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        SoilRecord record = soilRecordService.getById(id);
        if (record == null) {
            return ApiResponse.error("土壤记录不存在");
        }
        record.setDelFlag(1);
        record.setUpdateTime(new Date());
        boolean success = soilRecordService.updateById(record);
        if (success) {
            return ApiResponse.success(true);
        }
        return ApiResponse.error("删除失败");
    }
}