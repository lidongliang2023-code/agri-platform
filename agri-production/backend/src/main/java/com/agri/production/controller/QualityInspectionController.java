package com.agri.production.controller;

import com.agri.production.dto.QualityInspectionQueryDTO;
import com.agri.production.dto.QualityInspectionSaveDTO;
import com.agri.production.entity.InspectionItem;
import com.agri.production.entity.QualityInspection;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IQualityInspectionService;
import org.springframework.web.bind.annotation.*;

import com.agri.production.common.entity.PageResult;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/quality")
public class QualityInspectionController {

    private final IQualityInspectionService qualityInspectionService;

    public QualityInspectionController(IQualityInspectionService qualityInspectionService) {
        this.qualityInspectionService = qualityInspectionService;
    }

    @GetMapping("/inspections")
    public ApiResponse<PageResult<?>> listInspections(QualityInspectionQueryDTO dto) {
        return ApiResponse.success(qualityInspectionService.listInspections(dto, "T001"));
    }

    @GetMapping("/inspections/{id}")
    public ApiResponse<QualityInspection> getInspection(@PathVariable Long id) {
        QualityInspection inspection = qualityInspectionService.getInspectionById(id);
        return ApiResponse.success(inspection);
    }

    @PostMapping("/inspections")
    public ApiResponse<QualityInspection> saveInspection(@RequestBody QualityInspectionSaveDTO dto) {
        QualityInspection inspection = qualityInspectionService.saveInspection(dto, "T001");
        return ApiResponse.success(inspection);
    }

    @PutMapping("/inspections/{id}")
    public ApiResponse<QualityInspection> updateInspection(@PathVariable Long id, @RequestBody QualityInspectionSaveDTO dto) {
        dto.setId(id);
        QualityInspection inspection = qualityInspectionService.saveInspection(dto, "T001");
        return ApiResponse.success(inspection);
    }

    @DeleteMapping("/inspections/{id}")
    public ApiResponse<Void> deleteInspection(@PathVariable Long id) {
        qualityInspectionService.deleteInspection(id);
        return ApiResponse.success();
    }

    @PostMapping("/inspections/{id}/approve")
    public ApiResponse<Void> approveInspection(@PathVariable Long id, @RequestParam boolean approved, @RequestParam(required = false) String remark) {
        qualityInspectionService.approveInspection(id, approved, remark);
        return ApiResponse.success();
    }

    @GetMapping("/items")
    public ApiResponse<List<InspectionItem>> listItems() {
        List<InspectionItem> items = qualityInspectionService.listItems("T001");
        return ApiResponse.success(items);
    }

    @GetMapping("/items/{id}")
    public ApiResponse<InspectionItem> getItem(@PathVariable Long id) {
        InspectionItem item = qualityInspectionService.getItemById(id);
        return ApiResponse.success(item);
    }

    @PostMapping("/items")
    public ApiResponse<InspectionItem> saveItem(@RequestBody InspectionItem item) {
        InspectionItem saved = qualityInspectionService.saveItem(item, "T001");
        return ApiResponse.success(saved);
    }

    @PutMapping("/items/{id}")
    public ApiResponse<InspectionItem> updateItem(@PathVariable Long id, @RequestBody InspectionItem item) {
        item.setId(id);
        InspectionItem saved = qualityInspectionService.saveItem(item, "T001");
        return ApiResponse.success(saved);
    }

    @DeleteMapping("/items/{id}")
    public ApiResponse<Void> deleteItem(@PathVariable Long id) {
        qualityInspectionService.deleteItem(id);
        return ApiResponse.success();
    }

    @GetMapping("/statistics")
    public ApiResponse<Map<String, Object>> getStatistics() {
        Map<String, Object> statistics = qualityInspectionService.getInspectionStatistics("T001");
        return ApiResponse.success(statistics);
    }
}