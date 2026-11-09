package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.SupplierMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 货源企业档案由平台统一维护，不再授予外部供应商操作角色。 */
@RestController
@RequestMapping("/api/platform/supply-sources")
@OperatorOnly("s2b2c:platform")
public class PlatformSupplySourceController {
    private final SupplierMapper supplierMapper;

    public PlatformSupplySourceController(SupplierMapper supplierMapper) {
        this.supplierMapper = supplierMapper;
    }

    public record Source(Long id, String companyName, String shopName, String contactPhone,
                         String address, String auditStatus, String status) {}

    @GetMapping
    public List<Source> sources() {
        return supplierMapper.selectList(new LambdaQueryWrapper<Supplier>()
                .orderByDesc(Supplier::getCreateTime)).stream()
                .map(s -> new Source(s.getId(), s.getCompanyName(), s.getShopName(),
                        s.getContactPhone(), s.getAddress(), s.getAuditStatus(), s.getStatus())).toList();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Source body) {
        if (body.companyName() == null || body.companyName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "请填写货源企业名称"));
        }
        Supplier source = new Supplier();
        source.setCompanyName(body.companyName().trim());
        source.setShopName(body.shopName() == null || body.shopName().isBlank()
                ? body.companyName().trim() : body.shopName().trim());
        source.setContactPhone(body.contactPhone());
        source.setAddress(body.address());
        source.setAuditStatus("APPROVED");
        source.setStatus("ACTIVE");
        source.setAuditTime(LocalDateTime.now());
        source.setAuditOpinion("平台统一整合货源");
        source.setCreateTime(LocalDateTime.now());
        source.setUpdateTime(LocalDateTime.now());
        supplierMapper.insert(source);
        return ResponseEntity.ok(Map.of("success", true, "id", source.getId(), "message", "货源档案已建立"));
    }
}
