package com.agri.platform.internal.merchant;

import com.agri.platform.api.dto.MerchantDTO;
import com.agri.platform.api.facade.MerchantFacade;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 客商中心：云管家 CRUD。
 */
@RestController
@RequestMapping("/api/v1/admin/merchants")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantMapper merchantMapper;

    @Data
    public static class MerchantUpsertRequest {
        private String code;
        @NotBlank(message = "客商名称不能为空")
        private String name;
        /** CUSTOMER / SUPPLIER / BOTH */
        private String type;
        private String creditCode;
        private String contactName;
        private String contactPhone;
        private Integer status;
    }

    @GetMapping
    public ApiResponse<PageResult<MerchantEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) String type) {
        Page<MerchantEntity> result = merchantMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<MerchantEntity>()
                        .like(keyword != null && !keyword.isBlank(), MerchantEntity::getName, keyword)
                        .eq(type != null && !type.isBlank(), MerchantEntity::getType, type)
                        .orderByDesc(MerchantEntity::getCreatedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody MerchantUpsertRequest req) {
        MerchantEntity merchant = new MerchantEntity();
        copy(req, merchant);
        merchantMapper.insert(merchant);
        return ApiResponse.ok(merchant.getId());
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @Valid @RequestBody MerchantUpsertRequest req) {
        MerchantEntity merchant = merchantMapper.selectById(id);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        copy(req, merchant);
        merchantMapper.updateById(merchant);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        merchantMapper.deleteById(id);
        return ApiResponse.ok();
    }

    private void copy(MerchantUpsertRequest req, MerchantEntity merchant) {
        merchant.setCode(req.getCode());
        merchant.setName(req.getName());
        merchant.setType(req.getType());
        merchant.setCreditCode(req.getCreditCode());
        merchant.setContactName(req.getContactName());
        merchant.setContactPhone(req.getContactPhone());
        merchant.setStatus(req.getStatus() == null ? 1 : req.getStatus());
    }
}
