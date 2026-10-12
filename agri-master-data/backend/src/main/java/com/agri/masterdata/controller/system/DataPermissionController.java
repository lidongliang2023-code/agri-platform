package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.DataPermissionSaveDTO;
import com.agri.masterdata.service.IDataPermissionService;
import com.agri.masterdata.vo.DataPermissionVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/data-permission")
@RequiredArgsConstructor
@Tag(name = "数据权限管理", description = "数据权限配置接口")
public class DataPermissionController {

    private final IDataPermissionService dataPermissionService;

    @GetMapping("/role/{roleId}")
    @Operation(summary = "根据角色ID查询数据权限")
    public ApiResponse<List<DataPermissionVO>> getByRoleId(@Parameter(description = "角色ID") @PathVariable String roleId) {
        return ApiResponse.success(dataPermissionService.getByRoleId(roleId));
    }

    @GetMapping("/module/{moduleType}")
    @Operation(summary = "根据模块类型查询数据权限")
    public ApiResponse<List<DataPermissionVO>> getByModuleType(@Parameter(description = "模块类型") @PathVariable String moduleType) {
        return ApiResponse.success(dataPermissionService.getByModuleType(moduleType));
    }

    @GetMapping("/{dpId}")
    @Operation(summary = "获取数据权限详情")
    public ApiResponse<DataPermissionVO> getById(@Parameter(description = "数据权限ID") @PathVariable String dpId) {
        return ApiResponse.success(dataPermissionService.getById(dpId));
    }

    @PostMapping
    @Operation(summary = "新增数据权限配置")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody DataPermissionSaveDTO dto) {
        dataPermissionService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{dpId}")
    @Operation(summary = "更新数据权限配置")
    public ApiResponse<Void> update(@Parameter(description = "数据权限ID") @PathVariable String dpId,
                                    @Valid @RequestBody DataPermissionSaveDTO dto) {
        dataPermissionService.update(dpId, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{dpId}")
    @Operation(summary = "删除数据权限配置")
    public ApiResponse<Void> delete(@Parameter(description = "数据权限ID") @PathVariable String dpId) {
        dataPermissionService.delete(dpId);
        return ApiResponse.success();
    }

    @DeleteMapping("/role/{roleId}")
    @Operation(summary = "删除角色的所有数据权限配置")
    public ApiResponse<Void> deleteByRoleId(@Parameter(description = "角色ID") @PathVariable String roleId) {
        dataPermissionService.deleteByRoleId(roleId);
        return ApiResponse.success();
    }

    @PostMapping("/batch")
    @Operation(summary = "批量新增数据权限配置")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> saveBatch(@Valid @RequestBody List<DataPermissionSaveDTO> list) {
        dataPermissionService.saveBatch(list);
        return ApiResponse.created();
    }
}