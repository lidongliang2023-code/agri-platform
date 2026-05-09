package com.agri.masterdata.controller.address;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.LogisticsNodeSaveDTO;
import com.agri.masterdata.dto.LogisticsNodeUpdateDTO;
import com.agri.masterdata.service.ILogisticsNodeService;
import com.agri.masterdata.vo.LogisticsNodeVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/address/logistics-node")
@RequiredArgsConstructor
@Tag(name = "物流节点管理", description = "物流节点管理接口")
public class LogisticsNodeController {

    private final ILogisticsNodeService logisticsNodeService;

    @GetMapping("/page")
    @Operation(summary = "分页查询物流节点")
    public ApiResponse<PageResult<LogisticsNodeVO>> page(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") Integer pageSize,
            @Parameter(description = "节点名称") @RequestParam(required = false) String nodeName,
            @Parameter(description = "节点类型") @RequestParam(required = false) String nodeType) {
        return ApiResponse.success(logisticsNodeService.page(pageNum, pageSize, nodeName, nodeType));
    }

    @GetMapping("/region/{regionCode}")
    @Operation(summary = "根据行政区划编码查询物流节点")
    public ApiResponse<List<LogisticsNodeVO>> listByRegionCode(@Parameter(description = "行政区划编码") @PathVariable String regionCode) {
        return ApiResponse.success(logisticsNodeService.listByRegionCode(regionCode));
    }

    @GetMapping("/type/{nodeType}")
    @Operation(summary = "根据节点类型查询")
    public ApiResponse<List<LogisticsNodeVO>> listByNodeType(@Parameter(description = "节点类型") @PathVariable String nodeType) {
        return ApiResponse.success(logisticsNodeService.listByNodeType(nodeType));
    }

    @GetMapping("/{nodeId}")
    @Operation(summary = "获取物流节点详情")
    public ApiResponse<LogisticsNodeVO> getById(@Parameter(description = "节点ID") @PathVariable String nodeId) {
        return ApiResponse.success(logisticsNodeService.getById(nodeId));
    }

    @GetMapping("/code/{nodeCode}")
    @Operation(summary = "根据节点编码获取物流节点")
    public ApiResponse<LogisticsNodeVO> getByNodeCode(@Parameter(description = "节点编码") @PathVariable String nodeCode) {
        return ApiResponse.success(logisticsNodeService.getByNodeCode(nodeCode));
    }

    @PostMapping
    @Operation(summary = "新增物流节点")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody LogisticsNodeSaveDTO dto) {
        logisticsNodeService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{nodeId}")
    @Operation(summary = "更新物流节点")
    public ApiResponse<Void> update(@Parameter(description = "节点ID") @PathVariable String nodeId,
                                    @Valid @RequestBody LogisticsNodeUpdateDTO dto) {
        logisticsNodeService.update(nodeId, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{nodeId}")
    @Operation(summary = "删除物流节点")
    public ApiResponse<Void> delete(@Parameter(description = "节点ID") @PathVariable String nodeId) {
        logisticsNodeService.delete(nodeId);
        return ApiResponse.success();
    }

    @PutMapping("/{nodeId}/status")
    @Operation(summary = "修改物流节点状态")
    public ApiResponse<Void> changeStatus(@Parameter(description = "节点ID") @PathVariable String nodeId,
                                          @Parameter(description = "状态：active-正常，inactive-禁用") @RequestParam String status) {
        logisticsNodeService.changeStatus(nodeId, status);
        return ApiResponse.success();
    }
}