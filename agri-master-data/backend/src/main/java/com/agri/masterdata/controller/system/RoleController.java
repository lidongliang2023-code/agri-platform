package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.RolePageDTO;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.dto.RoleUpdateDTO;
import com.agri.masterdata.service.IRoleService;
import com.agri.masterdata.vo.RoleVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/role")
@RequiredArgsConstructor
public class RoleController {

    private final IRoleService roleService;

    @GetMapping("/page")
    public ApiResponse<PageResult<RoleVO>> page(RolePageDTO dto) {
        return ApiResponse.success(roleService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<RoleVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(roleService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid RoleSaveDTO dto) {
        roleService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid RoleUpdateDTO dto) {
        roleService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        roleService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Void> changeStatus(@PathVariable Long id, @RequestParam Integer status) {
        roleService.changeStatus(id, status);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/menus")
    public ApiResponse<List<Long>> getRoleMenus(@PathVariable Long id) {
        return ApiResponse.success(roleService.getRoleMenus(id));
    }

    @PutMapping("/{id}/menus")
    public ApiResponse<Void> assignMenus(@PathVariable Long id, @RequestBody List<Long> menuIds) {
        roleService.assignMenus(id, menuIds);
        return ApiResponse.success();
    }

    @GetMapping("/list")
    public ApiResponse<List<RoleVO>> list() {
        return ApiResponse.success(roleService.list());
    }
}
