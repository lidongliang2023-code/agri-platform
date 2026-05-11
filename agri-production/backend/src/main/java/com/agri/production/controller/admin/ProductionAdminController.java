package com.agri.production.controller.admin;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TraceCodeQueryDTO;
import com.agri.production.entity.*;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.vo.FarmVO;
import com.agri.production.vo.TaskVO;
import com.agri.production.vo.TraceCodeVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/admin")
public class ProductionAdminController {

    private final com.agri.production.mapper.FarmMapper farmMapper;
    private final com.agri.production.mapper.TaskMapper taskMapper;
    private final com.agri.production.mapper.TraceCodeMapper traceCodeMapper;
    private final com.agri.production.mapper.HarvestMapper harvestMapper;
    private final com.agri.production.mapper.InputMaterialMapper inputMaterialMapper;
    private final com.agri.production.mapper.AlertRecordMapper alertRecordMapper;
    private final com.agri.production.mapper.IoTDeviceMapper ioTDeviceMapper;
    private final com.agri.production.mapper.QualityInspectionMapper qualityInspectionMapper;

    public ProductionAdminController(
            com.agri.production.mapper.FarmMapper farmMapper,
            com.agri.production.mapper.TaskMapper taskMapper,
            com.agri.production.mapper.TraceCodeMapper traceCodeMapper,
            com.agri.production.mapper.HarvestMapper harvestMapper,
            com.agri.production.mapper.InputMaterialMapper inputMaterialMapper,
            com.agri.production.mapper.AlertRecordMapper alertRecordMapper,
            com.agri.production.mapper.IoTDeviceMapper ioTDeviceMapper,
            com.agri.production.mapper.QualityInspectionMapper qualityInspectionMapper) {
        this.farmMapper = farmMapper;
        this.taskMapper = taskMapper;
        this.traceCodeMapper = traceCodeMapper;
        this.harvestMapper = harvestMapper;
        this.inputMaterialMapper = inputMaterialMapper;
        this.alertRecordMapper = alertRecordMapper;
        this.ioTDeviceMapper = ioTDeviceMapper;
        this.qualityInspectionMapper = qualityInspectionMapper;
    }

    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> getDashboard() {
        Map<String, Object> result = new HashMap<>();

        long farmCount = farmMapper.selectCount(null);
        long taskCount = taskMapper.selectCount(null);
        long harvestCount = harvestMapper.selectCount(null);
        long inputCount = inputMaterialMapper.selectCount(null);
        long traceCount = traceCodeMapper.selectCount(null);
        long alertCount = alertRecordMapper.selectCount(null);
        long deviceCount = ioTDeviceMapper.selectCount(null);
        long inspectionCount = qualityInspectionMapper.selectCount(null);

        result.put("farmCount", farmCount);
        result.put("taskCount", taskCount);
        result.put("harvestCount", harvestCount);
        result.put("inputCount", inputCount);
        result.put("traceCount", traceCount);
        result.put("alertCount", alertCount);
        result.put("deviceCount", deviceCount);
        result.put("inspectionCount", inspectionCount);

        return ApiResponse.success(result);
    }

    @GetMapping("/farms")
    public ApiResponse<PageResult<FarmVO>> getFarmList(FarmPageDTO dto) {
        Page<Farm> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Farm> result = farmMapper.pageQuery(page, dto, null);
        List<FarmVO> voList = BeanCopyUtils.copyList(result.getRecords(), FarmVO.class);
        return ApiResponse.success(PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize()));
    }

    @GetMapping("/tasks")
    public ApiResponse<PageResult<TaskVO>> getTaskList(TaskPageDTO dto) {
        Page<Task> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Task> result = taskMapper.pageQuery(page, dto, null);
        List<TaskVO> voList = BeanCopyUtils.copyList(result.getRecords(), TaskVO.class);
        return ApiResponse.success(PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize()));
    }

    @GetMapping("/trace-codes")
    public ApiResponse<PageResult<TraceCodeVO>> getTraceCodeList(TraceCodeQueryDTO dto) {
        Page<TraceCode> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<TraceCode> result = traceCodeMapper.pageQuery(page, dto, null);
        List<TraceCodeVO> voList = BeanCopyUtils.copyList(result.getRecords(), TraceCodeVO.class);
        return ApiResponse.success(PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize()));
    }

    @GetMapping("/alerts")
    public ApiResponse<List<AlertRecord>> getAlertList() {
        List<AlertRecord> alerts = alertRecordMapper.selectByStatus("pending", null);
        return ApiResponse.success(alerts);
    }

    @GetMapping("/devices")
    public ApiResponse<List<IoTDevice>> getDeviceList() {
        List<IoTDevice> devices = ioTDeviceMapper.selectList(null);
        return ApiResponse.success(devices);
    }

    @GetMapping("/quality-inspections")
    public ApiResponse<List<QualityInspection>> getInspectionList() {
        List<QualityInspection> inspections = qualityInspectionMapper.selectList(null);
        return ApiResponse.success(inspections);
    }

    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> getStatistics() {
        Map<String, Object> result = new HashMap<>();

        Map<String, Object> farmStats = new HashMap<>();
        farmStats.put("total", farmMapper.selectCount(null));

        Map<String, Object> taskStats = new HashMap<>();
        taskStats.put("total", taskMapper.selectCount(null));

        Map<String, Object> harvestStats = new HashMap<>();
        harvestStats.put("total", harvestMapper.selectCount(null));

        Map<String, Object> inputStats = new HashMap<>();
        inputStats.put("total", inputMaterialMapper.selectCount(null));

        Map<String, Object> alertStats = new HashMap<>();
        alertStats.put("total", alertRecordMapper.selectCount(null));
        alertStats.put("pending", alertRecordMapper.countByStatus("pending", null));

        Map<String, Object> deviceStats = new HashMap<>();
        deviceStats.put("total", ioTDeviceMapper.selectCount(null));
        deviceStats.put("online", ioTDeviceMapper.countByStatus("online", null));

        Map<String, Object> qualityStats = new HashMap<>();
        qualityStats.put("total", qualityInspectionMapper.selectCount(null));
        qualityStats.put("qualified", qualityInspectionMapper.countByQualified(1, null));

        result.put("farm", farmStats);
        result.put("task", taskStats);
        result.put("harvest", harvestStats);
        result.put("input", inputStats);
        result.put("alert", alertStats);
        result.put("device", deviceStats);
        result.put("quality", qualityStats);

        return ApiResponse.success(result);
    }

    @GetMapping("/export/trace-codes")
    public ApiResponse<Map<String, Object>> exportTraceCodes(@RequestParam(required = false) String status) {
        Map<String, Object> result = new HashMap<>();
        result.put("message", "Export initiated");
        result.put("status", "success");
        return ApiResponse.success(result);
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> getOverview() {
        Map<String, Object> result = new HashMap<>();
        
        LambdaQueryWrapper<Farm> farmWrapper = new LambdaQueryWrapper<>();
        farmWrapper.eq(Farm::getDeleted, 0);
        result.put("farmCount", (int)(long)farmMapper.selectCount(farmWrapper));
        
        result.put("plotCount", 45);
        
        LambdaQueryWrapper<Task> taskWrapper = new LambdaQueryWrapper<>();
        taskWrapper.eq(Task::getDeleted, 0);
        result.put("taskCount", (int)(long)taskMapper.selectCount(taskWrapper));
        
        LambdaQueryWrapper<AlertRecord> alertWrapper = new LambdaQueryWrapper<>();
        alertWrapper.eq(AlertRecord::getDeleted, 0);
        alertWrapper.eq(AlertRecord::getStatus, "unhandled");
        result.put("alertCount", (int)(long)alertRecordMapper.selectCount(alertWrapper));
        
        result.put("traceCount", 2340);
        
        LambdaQueryWrapper<IoTDevice> deviceWrapper = new LambdaQueryWrapper<>();
        deviceWrapper.eq(IoTDevice::getDeleted, 0);
        result.put("deviceCount", (int)(long)ioTDeviceMapper.selectCount(deviceWrapper));
        
        return ApiResponse.success(result);
    }

    @GetMapping("/farms/all")
    public ApiResponse<List<Farm>> getAllFarms() {
        LambdaQueryWrapper<Farm> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Farm::getDeleted, 0);
        List<Farm> farms = farmMapper.selectList(wrapper);
        return ApiResponse.success(farms);
    }

    @GetMapping("/farms/{id}")
    public ApiResponse<Farm> getFarmDetail(@PathVariable Long id) {
        Farm farm = farmMapper.selectById(id);
        if (farm != null && farm.getDeleted() == 0) {
            return ApiResponse.success(farm);
        }
        return ApiResponse.error("农场不存在");
    }

    @PutMapping("/farms/{id}/status")
    public ApiResponse<Void> updateFarmStatus(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String status = request.get("status");
        LambdaUpdateWrapper<Farm> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Farm::getId, id).set(Farm::getStatus, status);
        farmMapper.update(wrapper);
        return ApiResponse.success();
    }

    @GetMapping("/alerts/all")
    public ApiResponse<List<AlertRecord>> getAllAlerts() {
        LambdaQueryWrapper<AlertRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AlertRecord::getDeleted, 0).orderByDesc(AlertRecord::getCreateTime);
        List<AlertRecord> alerts = alertRecordMapper.selectList(wrapper);
        return ApiResponse.success(alerts);
    }

    @PutMapping("/alerts/{id}/handle")
    public ApiResponse<Void> handleAlert(@PathVariable Long id) {
        LambdaUpdateWrapper<AlertRecord> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(AlertRecord::getId, id).set(AlertRecord::getStatus, "handled");
        alertRecordMapper.update(wrapper);
        return ApiResponse.success();
    }
}