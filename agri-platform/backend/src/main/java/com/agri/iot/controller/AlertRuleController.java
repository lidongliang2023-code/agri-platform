package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.dto.AlertRulePageDTO;
import com.agri.iot.dto.AlertRuleSaveDTO;
import com.agri.iot.dto.AlertRuleUpdateDTO;
import com.agri.iot.service.IAlertRuleService;
import com.agri.iot.vo.AlertRuleVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/alert-rule")
@RequiredArgsConstructor
public class AlertRuleController {

    private final IAlertRuleService alertRuleService;

    @GetMapping("/page")
    public ApiResponse<PageResult<AlertRuleVO>> page(AlertRulePageDTO dto) {
        return ApiResponse.success(alertRuleService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertRuleVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(alertRuleService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid AlertRuleSaveDTO dto) {
        alertRuleService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid AlertRuleUpdateDTO dto) {
        alertRuleService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        alertRuleService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Void> changeStatus(@PathVariable Long id, @RequestParam Integer status) {
        alertRuleService.changeStatus(id, status);
        return ApiResponse.success();
    }

    @GetMapping("/options")
    public ApiResponse<List<AlertRuleVO>> getOptions() {
        return ApiResponse.success(alertRuleService.listEnabled());
    }
}
