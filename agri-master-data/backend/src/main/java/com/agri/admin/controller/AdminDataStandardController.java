package com.agri.admin.controller;

import com.agri.admin.dto.CodeRuleDTO;
import com.agri.admin.dto.DataFormatDTO;
import com.agri.admin.service.IAdminDataStandardService;
import com.agri.admin.vo.CodeRuleVO;
import com.agri.admin.vo.DataFormatVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.vo.DictVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "数据标准管理")
@RestController
@RequestMapping("/admin/masterdata/standard")
@RequiredArgsConstructor
public class AdminDataStandardController {

    private final IAdminDataStandardService adminDataStandardService;

    @Operation(summary = "获取字典列表")
    @GetMapping("/dict/list")
    public ApiResponse<PageResult<DictVO>> getDictList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String dictName) {
        return ApiResponse.success(adminDataStandardService.getDictList(pageNum, pageSize, dictName));
    }

    @Operation(summary = "获取字典详情")
    @GetMapping("/dict/{id}")
    public ApiResponse<DictVO> getDictDetail(@PathVariable Long id) {
        return ApiResponse.success(adminDataStandardService.getDictDetail(id));
    }

    @Operation(summary = "创建字典")
    @PostMapping("/dict")
    public ApiResponse<Void> createDict(@RequestBody DictSaveDTO dto) {
        adminDataStandardService.createDict(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑字典")
    @PutMapping("/dict/{id}")
    public ApiResponse<Void> updateDict(@PathVariable Long id, @RequestBody DictSaveDTO dto) {
        adminDataStandardService.updateDict(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除字典")
    @DeleteMapping("/dict/{id}")
    public ApiResponse<Void> deleteDict(@PathVariable Long id) {
        adminDataStandardService.deleteDict(id);
        return ApiResponse.success();
    }

    @Operation(summary = "添加字典项")
    @PostMapping("/dict/{id}/item")
    public ApiResponse<Void> addDictItem(@PathVariable Long id, @RequestBody DictItemSaveDTO dto) {
        adminDataStandardService.addDictItem(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "获取编码规则列表")
    @GetMapping("/code-rule/list")
    public ApiResponse<List<CodeRuleVO>> getCodeRuleList() {
        return ApiResponse.success(adminDataStandardService.getCodeRuleList());
    }

    @Operation(summary = "获取编码规则详情")
    @GetMapping("/code-rule/{id}")
    public ApiResponse<CodeRuleVO> getCodeRuleDetail(@PathVariable Long id) {
        return ApiResponse.success(adminDataStandardService.getCodeRuleDetail(id));
    }

    @Operation(summary = "创建编码规则")
    @PostMapping("/code-rule")
    public ApiResponse<Void> createCodeRule(@RequestBody CodeRuleDTO dto) {
        adminDataStandardService.createCodeRule(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑编码规则")
    @PutMapping("/code-rule/{id}")
    public ApiResponse<Void> updateCodeRule(@PathVariable Long id, @RequestBody CodeRuleDTO dto) {
        adminDataStandardService.updateCodeRule(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除编码规则")
    @DeleteMapping("/code-rule/{id}")
    public ApiResponse<Void> deleteCodeRule(@PathVariable Long id) {
        adminDataStandardService.deleteCodeRule(id);
        return ApiResponse.success();
    }

    @Operation(summary = "测试编码规则")
    @PostMapping("/code-rule/{id}/test")
    public ApiResponse<String> testCodeRule(@PathVariable Long id) {
        return ApiResponse.success(adminDataStandardService.testCodeRule(id));
    }

    @Operation(summary = "获取数据格式标准列表")
    @GetMapping("/format/list")
    public ApiResponse<List<DataFormatVO>> getDataFormatList() {
        return ApiResponse.success(adminDataStandardService.getDataFormatList());
    }

    @Operation(summary = "创建数据格式标准")
    @PostMapping("/format")
    public ApiResponse<Void> createDataFormat(@RequestBody DataFormatDTO dto) {
        adminDataStandardService.createDataFormat(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "获取数据变更审批列表")
    @GetMapping("/change-approve")
    public ApiResponse<PageResult<DataFormatVO>> getChangeApproveList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminDataStandardService.getChangeApproveList(pageNum, pageSize, status));
    }

    @Operation(summary = "数据变更审批")
    @PutMapping("/change-approve/{id}")
    public ApiResponse<Void> approveChange(@PathVariable Long id, @RequestParam String status, @RequestParam(required = false) String remark) {
        adminDataStandardService.approveChange(id, status, remark);
        return ApiResponse.success();
    }
}