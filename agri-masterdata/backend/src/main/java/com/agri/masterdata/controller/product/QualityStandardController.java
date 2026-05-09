package com.agri.masterdata.controller.product;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.QualityStandardSaveDTO;
import com.agri.masterdata.dto.QualityStandardUpdateDTO;
import com.agri.masterdata.service.IQualityStandardService;
import com.agri.masterdata.vo.QualityStandardVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/product/quality-standard")
@RequiredArgsConstructor
@Tag(name = "质量标准管理", description = "商品质量标准管理接口")
public class QualityStandardController {

    private final IQualityStandardService qualityStandardService;

    @GetMapping("/page")
    @Operation(summary = "分页查询质量标准")
    public ApiResponse<PageResult<QualityStandardVO>> page(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") Integer pageSize,
            @Parameter(description = "标准编码") @RequestParam(required = false) String standardCode,
            @Parameter(description = "标准名称") @RequestParam(required = false) String standardName) {
        return ApiResponse.success(qualityStandardService.page(pageNum, pageSize, standardCode, standardName));
    }

    @GetMapping("/category/{categoryId}")
    @Operation(summary = "根据分类ID查询质量标准")
    public ApiResponse<List<QualityStandardVO>> listByCategoryId(@Parameter(description = "分类ID") @PathVariable Long categoryId) {
        return ApiResponse.success(qualityStandardService.listByCategoryId(categoryId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取质量标准详情")
    public ApiResponse<QualityStandardVO> getById(@Parameter(description = "质量标准ID") @PathVariable Long id) {
        return ApiResponse.success(qualityStandardService.getById(id));
    }

    @PostMapping
    @Operation(summary = "新增质量标准")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody QualityStandardSaveDTO dto) {
        qualityStandardService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新质量标准")
    public ApiResponse<Void> update(@Parameter(description = "质量标准ID") @PathVariable Long id,
                                    @Valid @RequestBody QualityStandardUpdateDTO dto) {
        qualityStandardService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除质量标准")
    public ApiResponse<Void> delete(@Parameter(description = "质量标准ID") @PathVariable Long id) {
        qualityStandardService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "修改质量标准状态")
    public ApiResponse<Void> changeStatus(@Parameter(description = "质量标准ID") @PathVariable Long id,
                                          @Parameter(description = "状态：1-启用，0-禁用") @RequestParam Integer status) {
        qualityStandardService.changeStatus(id, status);
        return ApiResponse.success();
    }
}