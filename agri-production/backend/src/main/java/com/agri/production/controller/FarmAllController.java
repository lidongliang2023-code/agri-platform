package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.FarmVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 全量农场列表（{@code GET /farms/all}）：头部农场切换器与「新建地块」的农场下拉在用。

 *
 * <p>契约是**裸数组**（页面 {@code listAllFarms(): Promise<Farm[]>}），不是分页结构 ——
 * 这里照契约给数组，不套 PageResult；出参用 {@link FarmVO}（已带 farmId/areaTotal 的页面口径别名）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/farms")
public class FarmAllController {

    private final FarmMapper farmMapper;

    public FarmAllController(FarmMapper farmMapper) {
        this.farmMapper = farmMapper;
    }

    /** 当前租户的全部农场（按主键升序，便于下拉稳定排序）。 */
    @GetMapping("/all")
    public ApiResponse<List<FarmVO>> all() {
        String tenantId = TenantContextService.currentTenantId();
        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<Farm>()
                .eq(Farm::getTenantId, tenantId)
                .orderByAsc(Farm::getId));
        return ApiResponse.success(farms.stream().map(farm -> BeanCopyUtils.copy(farm, FarmVO.class)).toList());
    }
}
