package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.TenantContextService;
import com.agri.production.service.impl.PlotSoilServiceImpl;
import com.agri.production.vo.SoilTestRecordVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 地块土壤检测档案（{@code /api/v1/production/plots/{plotId}/soil*}）。

 *
 * <p>四条端点：分页 {@code /soil}、裸数组 {@code /soil-tests}、最近一次 {@code /soil/latest}、新增 {@code /soil}。
 * 地块标识接受本地主键 / 地块编码 / 平台侧标识（DEMO-PLOT-xxx），由 PlotIdResolver 统一换算；
 * 换不出来 404 而不是静默返回空列表。</p>
 */
@RestController
@RequestMapping("/api/v1/production/plots/{plotId}")
public class PlotSoilController {

    private final PlotSoilServiceImpl soilService;

    public PlotSoilController(PlotSoilServiceImpl soilService) {
        this.soilService = soilService;
    }

    /** 分页查询土壤检测档案（按检测日期倒序）。 */
    @GetMapping("/soil")
    public ApiResponse<PageResult<SoilTestRecordVO>> page(
            @PathVariable String plotId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.success(soilService.page(TenantContextService.currentTenantId(), plotId,
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10)));
    }

    /** 查询全部土壤检测档案（裸数组，不吃 page/size —— 页面注释里写明了这一点）。 */
    @GetMapping("/soil-tests")
    public ApiResponse<List<SoilTestRecordVO>> listAll(@PathVariable String plotId) {
        return ApiResponse.success(soilService.listAll(TenantContextService.currentTenantId(), plotId));
    }

    /** 最近一次土壤检测（无记录时 data 为 null）。 */
    @GetMapping("/soil/latest")
    public ApiResponse<SoilTestRecordVO> latest(@PathVariable String plotId) {
        return ApiResponse.success(soilService.latest(TenantContextService.currentTenantId(), plotId));
    }

    /** 新增土壤检测档案（返回新档案编号）。 */
    @PostMapping("/soil")
    public ApiResponse<String> create(@PathVariable String plotId,
                                     @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(soilService.create(TenantContextService.currentTenantId(), plotId, body));
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
