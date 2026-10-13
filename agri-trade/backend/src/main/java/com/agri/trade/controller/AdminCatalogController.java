package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.ProductViolation;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.service.AdminCatalogService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 商品违规与品类管理（运营端）。
 *
 * <p>两组接口合在一个控制器里，是因为它们在 PRD 里同属一组、页面上也是同一页的两个页签。</p>
 */
@RestController
@RequestMapping("/api/trade/admin")
@RequiredArgsConstructor
public class AdminCatalogController {

    private final AdminCatalogService catalogService;

    // ------------------------------ 品类管理 ------------------------------

    @Operation(summary = "品类列表（含停用）")
    @GetMapping("/category/page")
    public ApiResponse<IPage<TradeProductCategory>> categoryPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) Integer status) {
        return ApiResponse.success(catalogService.categoryPage(pageNum, pageSize, parentId, status));
    }

    @Operation(summary = "新建品类")
    @PostMapping("/category")
    public ApiResponse<Boolean> createCategory(@RequestBody TradeProductCategory category) {
        String error = catalogService.createCategory(category);
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }

    @Operation(summary = "修改品类")
    @PutMapping("/category/{id}")
    public ApiResponse<Boolean> updateCategory(@PathVariable Long id, @RequestBody TradeProductCategory category) {
        String error = catalogService.updateCategory(id, category);
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }

    @Operation(summary = "删除品类")
    @DeleteMapping("/category/{id}")
    public ApiResponse<Boolean> deleteCategory(@PathVariable Long id) {
        String error = catalogService.deleteCategory(id);
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }

    // ------------------------------ 商品违规 ------------------------------

    @Operation(summary = "违规处置记录")
    @GetMapping("/violation/page")
    public ApiResponse<IPage<ProductViolation>> violationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String violationStatus,
            @RequestParam(required = false) String productName) {
        return ApiResponse.success(catalogService.violationPage(pageNum, pageSize, violationStatus, productName));
    }

    /** 违规下架。必须给原因。 */
    @Operation(summary = "违规下架")
    @PostMapping("/violation")
    public ApiResponse<Boolean> takeDown(@RequestBody Map<String, Object> params) {
        Long productId = params.get("productId") == null ? null
                : Long.valueOf(params.get("productId").toString());
        if (productId == null) {
            return ApiResponse.error("请指定要处置的货源");
        }
        String reason = params.get("reason") == null ? null : params.get("reason").toString();
        String type = params.get("violationType") == null ? null : params.get("violationType").toString();
        String error = catalogService.takeDown(productId, type, reason, SecurityUtils.getUsername());
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }

    /** 撤销处置（恢复上架）。 */
    @Operation(summary = "撤销违规处置")
    @PostMapping("/violation/{id}/revoke")
    public ApiResponse<Boolean> revoke(@PathVariable Long id, @RequestBody(required = false) Map<String, String> params) {
        String reason = params == null ? null : params.get("revokeReason");
        String error = catalogService.revoke(id, reason, SecurityUtils.getUsername());
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }
}
