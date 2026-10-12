package com.agri.masterdata.controller.supplier;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.service.ISupplierService;
import com.agri.masterdata.vo.SupplierVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/supplier")
@RequiredArgsConstructor
public class SupplierController {

    private final ISupplierService supplierService;

    @GetMapping("/list")
    public ApiResponse<List<SupplierVO>> list() {
        return ApiResponse.success(supplierService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<SupplierVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(supplierService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid SupplierSaveDTO dto) {
        supplierService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid SupplierSaveDTO dto) {
        supplierService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        supplierService.delete(id);
        return ApiResponse.success();
    }
}
