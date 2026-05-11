package com.agri.production.controller;

import com.agri.production.dto.TraceCodeGenerateDTO;
import com.agri.production.dto.TraceCodeQueryDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.ITraceCodeService;
import com.agri.production.vo.TraceCodeVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/production/trace")
public class TraceController {

    private final ITraceCodeService traceCodeService;

    public TraceController(ITraceCodeService traceCodeService) {
        this.traceCodeService = traceCodeService;
    }

    @PostMapping("/generate")
    public ApiResponse<List<TraceCodeVO>> generate(@Valid @RequestBody TraceCodeGenerateDTO dto) {
        String tenantId = "T001";
        List<TraceCodeVO> list = traceCodeService.generate(dto, tenantId);
        return ApiResponse.success(list);
    }

    @PostMapping("/{traceCode}/activate")
    public ApiResponse<TraceCodeVO> activate(@PathVariable String traceCode) {
        String tenantId = "T001";
        TraceCodeVO vo = traceCodeService.activate(traceCode, tenantId);
        return ApiResponse.success(vo);
    }

    @PostMapping("/{traceCode}/deactivate")
    public ApiResponse<Void> deactivate(@PathVariable String traceCode) {
        String tenantId = "T001";
        traceCodeService.deactivate(traceCode, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/query/{traceCode}")
    public ApiResponse<TraceCodeVO> query(@PathVariable String traceCode) {
        TraceCodeVO vo = traceCodeService.queryForConsumer(traceCode);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{traceCode}")
    public ApiResponse<TraceCodeVO> getByTraceCode(@PathVariable String traceCode) {
        String tenantId = "T001";
        TraceCodeVO vo = traceCodeService.getByTraceCode(traceCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<TraceCodeVO>> pageQuery(TraceCodeQueryDTO dto) {
        String tenantId = "T001";
        PageResult<TraceCodeVO> result = traceCodeService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @GetMapping("/harvest/{harvestId}")
    public ApiResponse<List<TraceCodeVO>> listByHarvestId(@PathVariable Long harvestId) {
        String tenantId = "T001";
        List<TraceCodeVO> list = traceCodeService.listByHarvestId(harvestId, tenantId);
        return ApiResponse.success(list);
    }
}