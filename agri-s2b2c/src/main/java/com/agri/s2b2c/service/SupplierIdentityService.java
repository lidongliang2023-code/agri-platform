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
