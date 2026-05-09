package com.agri.masterdata.controller.relation;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.entity.CustomerSupplierRelation;
import com.agri.masterdata.service.IRelationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/master-data/relations")
@RequiredArgsConstructor
public class RelationController {

    private final IRelationService relationService;

    @GetMapping("/customer/{customerId}")
    public ApiResponse<List<CustomerSupplierRelation>> listByCustomerId(@PathVariable String customerId) {
        List<CustomerSupplierRelation> relations = relationService.listByCustomerId(customerId);
        return ApiResponse.success(relations);
    }

    @GetMapping("/supplier/{supplierId}")
    public ApiResponse<List<CustomerSupplierRelation>> listBySupplierId(@PathVariable String supplierId) {
        List<CustomerSupplierRelation> relations = relationService.listBySupplierId(supplierId);
        return ApiResponse.success(relations);
    }

    @GetMapping("/type/{relationType}")
    public ApiResponse<List<CustomerSupplierRelation>> listByRelationType(@PathVariable String relationType) {
        List<CustomerSupplierRelation> relations = relationService.listByRelationType(relationType);
        return ApiResponse.success(relations);
    }

    @GetMapping("/{relationId}")
    public ApiResponse<CustomerSupplierRelation> getById(@PathVariable String relationId) {
        CustomerSupplierRelation relation = relationService.getById(relationId);
        return ApiResponse.success(relation);
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody CustomerSupplierRelation relation) {
        relationService.save(relation);
        return ApiResponse.success();
    }

    @PutMapping("/{relationId}")
    public ApiResponse<Void> update(@PathVariable String relationId, @RequestBody CustomerSupplierRelation relation) {
        relationService.update(relationId, relation);
        return ApiResponse.success();
    }

    @DeleteMapping("/{relationId}")
    public ApiResponse<Void> delete(@PathVariable String relationId) {
        relationService.delete(relationId);
        return ApiResponse.success();
    }

    @PutMapping("/{relationId}/transaction")
    public ApiResponse<Void> updateTransaction(@PathVariable String relationId, @RequestBody Map<String, Object> params) {
        Integer count = (Integer) params.get("count");
        Double amount = (Double) params.get("amount");
        relationService.updateTransaction(relationId, count, amount);
        return ApiResponse.success();
    }
}