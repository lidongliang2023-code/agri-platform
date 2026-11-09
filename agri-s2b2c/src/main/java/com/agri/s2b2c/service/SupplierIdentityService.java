package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.SupplierMapper;
import com.agri.s2b2c.security.SecurityUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** 平台账号 ↔ 商城供应商档案。 */
@Service
@RequiredArgsConstructor
public class SupplierIdentityService {

    private final SupplierMapper supplierMapper;

    public Supplier currentOrNull() {
        org.springframework.web.context.request.RequestAttributes attributes =
                org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attributes instanceof org.springframework.web.context.request.ServletRequestAttributes servlet) {
            jakarta.servlet.http.HttpServletRequest request = servlet.getRequest();
            if (request.getRequestURI().startsWith("/api/platform/supply")) {
                String selected = request.getHeader("X-Supply-Source-Id");
                if (selected == null || selected.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先选择货源档案");
                }
                try {
                    Supplier source = supplierMapper.selectById(Long.valueOf(selected));
                    if (source == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "货源档案不存在");
                    return source;
                } catch (NumberFormatException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "货源档案编号无效");
                }
            }
        }
        Long userId = SecurityUtils.getUserId();
        if (userId == null) {
            return null;
        }
        return supplierMapper.selectOne(new LambdaQueryWrapper<Supplier>()
                .eq(Supplier::getUserId, userId)
                .last("LIMIT 1"));
    }

    /** 商品写入等动作要求当前账号已入驻商城（有供应商档案）。 */
    public Supplier requireCurrent() {
        Supplier supplier = currentOrNull();
        if (supplier == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前账号还没有商城供应商档案，请先提交入驻申请");
        }
        return supplier;
    }

    public void requireOwnSupplier(Long supplierId) {
        Supplier mine = requireCurrent();
        if (supplierId != null && !supplierId.equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作其他供应商的商品");
        }
    }
}
