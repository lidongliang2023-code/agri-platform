package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.MenuSaveDTO;
import com.agri.masterdata.dto.MenuUpdateDTO;
import com.agri.masterdata.service.IMenuService;
import com.agri.masterdata.vo.MenuVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/menu")
@RequiredArgsConstructor
public class MenuController {

    private final IMenuService menuService;

    @GetMapping("/tree")
    public ApiResponse<List<MenuVO>> getTree() {
        return ApiResponse.success(menuService.getTree());
    }

    @GetMapping("/perms")
    public ApiResponse<List<String>> getUserPermissions() {
        return ApiResponse.success(menuService.getUserPermissions());
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid MenuSaveDTO dto) {
        menuService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid MenuUpdateDTO dto) {
        menuService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        menuService.delete(id);
        return ApiResponse.success();
    }
}
