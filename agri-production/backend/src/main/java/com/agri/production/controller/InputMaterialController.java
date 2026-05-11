package com.agri.production.controller;

import com.agri.production.dto.InputMaterialPageDTO;
import com.agri.production.dto.InputMaterialSaveDTO;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IInputMaterialService;
import com.agri.production.vo.InputMaterialVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/inputs")
public class InputMaterialController {

    private final IInputMaterialService inputMaterialService;

    public InputMaterialController(IInputMaterialService inputMaterialService) {
        this.inputMaterialService = inputMaterialService;
    }

    @PostMapping
    public ApiResponse<InputMaterialVO> create(@Valid @RequestBody InputMaterialSaveDTO dto) {
        String tenantId = "T001";
        InputMaterialVO vo = inputMaterialService.save(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @PutMapping("/{id}")
    public ApiResponse<InputMaterialVO> update(@PathVariable Long id, @Valid @RequestBody InputMaterialSaveDTO dto) {
        dto.setId(id);
        String tenantId = "T001";
        InputMaterialVO vo = inputMaterialService.update(dto, tenantId);
        return ApiResponse.success(vo);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String tenantId = "T001";
        inputMaterialService.delete(id, tenantId);
        return ApiResponse.success();
    }

    @GetMapping("/{id}")
    public ApiResponse<InputMaterialVO> getById(@PathVariable Long id) {
        String tenantId = "T001";
        InputMaterialVO vo = inputMaterialService.getById(id, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping("/code/{materialCode}")
    public ApiResponse<InputMaterialVO> getByCode(@PathVariable String materialCode) {
        String tenantId = "T001";
        InputMaterialVO vo = inputMaterialService.getByCode(materialCode, tenantId);
        return ApiResponse.success(vo);
    }

    @GetMapping
    public ApiResponse<PageResult<InputMaterialVO>> pageQuery(InputMaterialPageDTO dto) {
        String tenantId = "T001";
        PageResult<InputMaterialVO> result = inputMaterialService.pageQuery(dto, tenantId);
        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/stock-in")
    public ApiResponse<InputMaterialVO> stockIn(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String tenantId = "T001";
        BigDecimal quantity = new BigDecimal(body.get("quantity").toString());
        String batchNumber = (String) body.get("batchNumber");
        InputMaterialVO vo = inputMaterialService.stockIn(id, quantity, batchNumber, tenantId);
        return ApiResponse.success(vo);
    }

    @PostMapping("/{id}/stock-out")
    public ApiResponse<InputMaterialVO> stockOut(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String tenantId = "T001";
        BigDecimal quantity = new BigDecimal(body.get("quantity").toString());
        String usageTaskId = (String) body.get("usageTaskId");
        InputMaterialVO vo = inputMaterialService.stockOut(id, quantity, usageTaskId, tenantId);
        return ApiResponse.success(vo);
    }
}