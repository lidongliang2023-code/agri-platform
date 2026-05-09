package com.agri.masterdata.controller.address;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.entity.AddressRegion;
import com.agri.masterdata.entity.LogisticsNode;
import com.agri.masterdata.entity.ProductRegion;
import com.agri.masterdata.service.IAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/master-data/address")
@RequiredArgsConstructor
public class AddressController {

    private final IAddressService addressService;

    @GetMapping("/regions/tree")
    public ApiResponse<List<AddressRegion>> getRegionTree(@RequestParam(required = false) String parentCode) {
        List<AddressRegion> tree = addressService.getRegionTree(parentCode);
        return ApiResponse.success(tree);
    }

    @GetMapping("/regions/level/{level}")
    public ApiResponse<List<AddressRegion>> getByLevel(@PathVariable Integer level) {
        List<AddressRegion> regions = addressService.getByLevel(level);
        return ApiResponse.success(regions);
    }

    @GetMapping("/regions/code/{regionCode}")
    public ApiResponse<AddressRegion> getByRegionCode(@PathVariable String regionCode) {
        AddressRegion region = addressService.getByRegionCode(regionCode);
        return ApiResponse.success(region);
    }

    @GetMapping("/regions/{regionId}")
    public ApiResponse<AddressRegion> getById(@PathVariable String regionId) {
        AddressRegion region = addressService.getById(regionId);
        return ApiResponse.success(region);
    }

    @PostMapping("/regions")
    public ApiResponse<Void> saveRegion(@RequestBody AddressRegion region) {
        addressService.saveRegion(region);
        return ApiResponse.success();
    }

    @PutMapping("/regions/{regionId}")
    public ApiResponse<Void> updateRegion(@PathVariable String regionId, @RequestBody AddressRegion region) {
        addressService.updateRegion(regionId, region);
        return ApiResponse.success();
    }

    @PostMapping("/standardize")
    public ApiResponse<Map<String, Object>> standardizeAddress(@RequestBody Map<String, String> request) {
        String rawAddress = request.get("address");
        Map<String, Object> result = addressService.standardizeAddress(rawAddress);
        return ApiResponse.success(result);
    }

    @PostMapping("/complete")
    public ApiResponse<List<String>> completeAddress(@RequestBody Map<String, String> request) {
        String partialAddress = request.get("address");
        List<String> suggestions = addressService.completeAddress(partialAddress);
        return ApiResponse.success(suggestions);
    }

    @PostMapping("/validate")
    public ApiResponse<Boolean> validateAddress(@RequestBody Map<String, Object> address) {
        boolean valid = addressService.validateAddress(address);
        return ApiResponse.success(valid);
    }

    @GetMapping("/production-regions")
    public ApiResponse<List<ProductRegion>> listProductRegions(@RequestParam(required = false) String regionType) {
        List<ProductRegion> regions = addressService.listProductRegions(regionType);
        return ApiResponse.success(regions);
    }

    @GetMapping("/production-regions/{regionId}")
    public ApiResponse<ProductRegion> getProductRegionById(@PathVariable String regionId) {
        ProductRegion region = addressService.getProductRegionById(regionId);
        return ApiResponse.success(region);
    }

    @PostMapping("/production-regions")
    public ApiResponse<Void> saveProductRegion(@RequestBody ProductRegion region) {
        addressService.saveProductRegion(region);
        return ApiResponse.success();
    }

    @PutMapping("/production-regions/{regionId}")
    public ApiResponse<Void> updateProductRegion(@PathVariable String regionId, @RequestBody ProductRegion region) {
        addressService.updateProductRegion(regionId, region);
        return ApiResponse.success();
    }

    @DeleteMapping("/production-regions/{regionId}")
    public ApiResponse<Void> deleteProductRegion(@PathVariable String regionId) {
        addressService.deleteProductRegion(regionId);
        return ApiResponse.success();
    }

    @GetMapping("/logistics-nodes")
    public ApiResponse<List<LogisticsNode>> listLogisticsNodes(
            @RequestParam(required = false) String regionCode,
            @RequestParam(required = false) String nodeType) {
        List<LogisticsNode> nodes = addressService.listLogisticsNodes(regionCode, nodeType);
        return ApiResponse.success(nodes);
    }

    @GetMapping("/logistics-nodes/{nodeId}")
    public ApiResponse<LogisticsNode> getLogisticsNodeById(@PathVariable String nodeId) {
        LogisticsNode node = addressService.getLogisticsNodeById(nodeId);
        return ApiResponse.success(node);
    }

    @PostMapping("/logistics-nodes")
    public ApiResponse<Void> saveLogisticsNode(@RequestBody LogisticsNode node) {
        addressService.saveLogisticsNode(node);
        return ApiResponse.success();
    }

    @PutMapping("/logistics-nodes/{nodeId}")
    public ApiResponse<Void> updateLogisticsNode(@PathVariable String nodeId, @RequestBody LogisticsNode node) {
        addressService.updateLogisticsNode(nodeId, node);
        return ApiResponse.success();
    }

    @DeleteMapping("/logistics-nodes/{nodeId}")
    public ApiResponse<Void> deleteLogisticsNode(@PathVariable String nodeId) {
        addressService.deleteLogisticsNode(nodeId);
        return ApiResponse.success();
    }
}