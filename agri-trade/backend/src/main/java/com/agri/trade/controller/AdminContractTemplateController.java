package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.ContractTemplate;
import com.agri.trade.mapper.ContractTemplateMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;

/**
 * 合同模板（运营端）。
 *
 * <p>模板是**全平台共用**的格式（标准购销、远期购销、框架采购），
 * 所以维护入口归运营端：用户侧只保留 {@code GET /contract/template/list} 供起草合同时选用。</p>
 *
 * <p>原先只有用户侧的 page/list/create 三个接口，没有删除，也没有页面 ——
 * 模板加进去就撤不回来了。删除走的是软删（与其它模块同一套口径）。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/contract-template")
@RequiredArgsConstructor
public class AdminContractTemplateController {

    private final ContractTemplateMapper templateMapper;

    @Operation(summary = "合同模板列表")
    @GetMapping("/page")
    public ApiResponse<IPage<ContractTemplate>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String templateName) {
        LambdaQueryWrapper<ContractTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractTemplate::getDelFlag, 0);
        if (templateName != null && !templateName.isEmpty()) {
            wrapper.like(ContractTemplate::getTemplateName, templateName);
        }
        wrapper.orderByAsc(ContractTemplate::getSortOrder);
        return ApiResponse.success(templateMapper.selectPage(new Page<>(pageNum, pageSize), wrapper));
    }

    /** 新建模板。模板编码由服务端生成，不允许前端指定（那是留痕用的）。 */
    @Operation(summary = "新建合同模板")
    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody ContractTemplate template) {
        if (template.getTemplateName() == null || template.getTemplateName().trim().isEmpty()) {
            return ApiResponse.error("模板名称不能为空");
        }
        if (template.getTemplateContent() == null || template.getTemplateContent().trim().isEmpty()) {
            return ApiResponse.error("模板内容不能为空");
        }
        template.setId(null);
        template.setTemplateCode("TPL" + System.currentTimeMillis());
        template.setDelFlag(0);
        if (template.getStatus() == null) {
            template.setStatus(1);
        }
        if (template.getSortOrder() == null) {
            template.setSortOrder(99);
        }
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        int result = templateMapper.insert(template);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    /** 修改模板（不改编码）。 */
    @Operation(summary = "修改合同模板")
    @PutMapping("/{id}")
    public ApiResponse<Boolean> update(@PathVariable Long id, @RequestBody ContractTemplate template) {
        ContractTemplate exist = templateMapper.selectById(id);
        if (exist == null || (exist.getDelFlag() != null && exist.getDelFlag() == 1)) {
            return ApiResponse.error("模板不存在");
        }
        template.setId(id);
        template.setTemplateCode(null);
        template.setDelFlag(null);
        template.setUpdateTime(new Date());
        templateMapper.updateById(template);
        return ApiResponse.success(true);
    }

    /** 删除模板（软删）。 */
    @Operation(summary = "删除合同模板")
    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable Long id) {
        ContractTemplate exist = templateMapper.selectById(id);
        if (exist == null) {
            return ApiResponse.error("模板不存在");
        }
        int result = templateMapper.deleteById(id);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }
}
