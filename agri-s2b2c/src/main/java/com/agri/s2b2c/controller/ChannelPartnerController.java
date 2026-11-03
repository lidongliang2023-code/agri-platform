package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.CommissionSettlement;
import com.agri.s2b2c.entity.CommissionWithdrawal;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.security.CapabilityCodes;
import com.agri.s2b2c.security.SecurityUtils;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.agri.s2b2c.service.DistributionRuleService;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.CommissionSettlementMapper;
import com.agri.s2b2c.mapper.CommissionWithdrawalMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.service.ChannelPartnerService;
import com.agri.s2b2c.service.SupplierRecruitService;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.vo.ChannelPartnerVO;
import com.agri.s2b2c.vo.CommissionVO;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.common.rbac.OperatorOnly;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/channel")
@OperatorOnly("s2b2c:channel")
public class ChannelPartnerController {

    private final ChannelPartnerService channelPartnerService;
    private final ProductService productService;
    private final ChannelIdentityService channelIdentityService;
    private final CommissionMapper commissionMapper;
    private final CommissionWithdrawalMapper withdrawalMapper;
    private final CommissionSettlementMapper settlementMapper;
    private final OrderMapper orderMapper;
    private final SupplierRecruitService recruitService;
    private final DistributionRuleService distributionRuleService;

    public ChannelPartnerController(ChannelPartnerService channelPartnerService, ProductService productService,
                                    ChannelIdentityService channelIdentityService,
                                    CommissionMapper commissionMapper,
                                    CommissionWithdrawalMapper withdrawalMapper,
                                    CommissionSettlementMapper settlementMapper,
                                    OrderMapper orderMapper,
                                    SupplierRecruitService recruitService,
                                    DistributionRuleService distributionRuleService) {
        this.channelPartnerService = channelPartnerService;
        this.productService = productService;
        this.channelIdentityService = channelIdentityService;
        this.commissionMapper = commissionMapper;
        this.withdrawalMapper = withdrawalMapper;
        this.settlementMapper = settlementMapper;
        this.orderMapper = orderMapper;
        this.recruitService = recruitService;
        this.distributionRuleService = distributionRuleService;
    }

    /** 佣金余额：已结算总额、已申请/已提取、可提现余额。 */
    @GetMapping("/commission-summary")
    public ResponseEntity<Map<String, Object>> commissionSummary() {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        BigDecimal settled = sumCommission(mine.getId());
        BigDecimal pending = sumPendingCommission(mine.getId());
        BigDecimal frozen = sumWithdrawals(mine.getId(), List.of("PENDING", "APPROVED", "PAID"));
        Map<String, Object> data = new HashMap<>();
        data.put("settledTotal", settled);
        data.put("pendingTotal", pending);
        data.put("withdrawnTotal", sumWithdrawals(mine.getId(), List.of("APPROVED", "PAID")));
        data.put("frozenTotal", sumWithdrawals(mine.getId(), List.of("PENDING")));
        data.put("available", settled.subtract(frozen).max(BigDecimal.ZERO));
        return ResponseEntity.ok(data);
    }

    /** 我的渠道订单：只返回渠道归属为本渠道的订单。 */
    @GetMapping("/orders")
    public ResponseEntity<IPage<Order>> orders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
                .eq(Order::getChannelId, mine.getId());
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Order::getStatus, status);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Order::getOrderNo, keyword.trim());
        }
        wrapper.orderByDesc(Order::getCreateTime);
        return ResponseEntity.ok(orderMapper.selectPage(new Page<>(page, size), wrapper));
    }

    /** 申请提现：金额不能超过可提现余额，且同一渠道同时只能有一笔待审申请。 */
    @PostMapping("/withdrawal")
    public ResponseEntity<Map<String, Object>> applyWithdrawal(@RequestBody Map<String, Object> body) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(body == null ? null : body.get("amount")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "提现金额必须是数字"));
        }
        if (amount.signum() <= 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "提现金额必须大于 0"));
        }
        Long pending = withdrawalMapper.selectCount(new LambdaQueryWrapper<CommissionWithdrawal>()
                .eq(CommissionWithdrawal::getChannelId, mine.getId())
                .eq(CommissionWithdrawal::getStatus, "PENDING"));
        if (pending != null && pending > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "已有一笔待审核的提现申请，请等待处理"));
        }
        BigDecimal available = sumCommission(mine.getId())
                .subtract(sumWithdrawals(mine.getId(), List.of("PENDING", "APPROVED", "PAID"))).max(BigDecimal.ZERO);
        if (amount.compareTo(available) > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "可提现余额不足，当前可提现 " + available));
        }
        CommissionWithdrawal withdrawal = new CommissionWithdrawal();
        withdrawal.setChannelId(mine.getId());
        withdrawal.setAmount(amount);
        withdrawal.setStatus("PENDING");
        withdrawal.setApplyTime(LocalDateTime.now());
        withdrawal.setUpdateTime(LocalDateTime.now());
        withdrawalMapper.insert(withdrawal);
        return ResponseEntity.ok(Map.of("success", true, "message", "提现申请已提交，等待运营审核"));
    }

    /** 我的提现记录。 */
    @GetMapping("/withdrawals")
    public ResponseEntity<List<CommissionWithdrawal>> withdrawals() {
        ChannelPartner mine = channelIdentityService.requireCurrent();
        return ResponseEntity.ok(withdrawalMapper.selectList(new LambdaQueryWrapper<CommissionWithdrawal>()
                .eq(CommissionWithdrawal::getChannelId, mine.getId())
                .orderByDesc(CommissionWithdrawal::getApplyTime)));
    }

    /** 我的结算批次。 */
    @GetMapping("/settlements")
    public ResponseEntity<List<CommissionSettlement>> settlements() {
        ChannelPartner mine = channelIdentityService.requireCurrent();
        return ResponseEntity.ok(settlementMapper.selectList(new LambdaQueryWrapper<CommissionSettlement>()
                .and(w -> w.eq(CommissionSettlement::getChannelId, mine.getId())
                        .or().isNull(CommissionSettlement::getChannelId))
                .orderByDesc(CommissionSettlement::getCreatedAt)));
    }

    private BigDecimal sumCommission(Long channelId) {
        List<Commission> rows = commissionMapper.selectList(new LambdaQueryWrapper<Commission>()
                .eq(Commission::getChannelId, channelId)
                .eq(Commission::getStatus, "SETTLED"));
        return rows.stream().map(Commission::getAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumPendingCommission(Long channelId) {
        List<Commission> rows = commissionMapper.selectList(new LambdaQueryWrapper<Commission>()
                .eq(Commission::getChannelId, channelId)
                .eq(Commission::getStatus, "PENDING"));
        return rows.stream().map(Commission::getAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumWithdrawals(Long channelId, List<String> statuses) {
        List<CommissionWithdrawal> rows = withdrawalMapper.selectList(new LambdaQueryWrapper<CommissionWithdrawal>()
                .eq(CommissionWithdrawal::getChannelId, channelId)
                .in(CommissionWithdrawal::getStatus, statuses));
        return rows.stream().map(CommissionWithdrawal::getAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 当前账号的渠道档案。未入驻时 applied=false，而不是 404 ——
     * 前端首屏据此决定"去入驻"还是进入工作台。
     */
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> profile() {
        ChannelPartner mine = channelIdentityService.currentOrNull();
        Map<String, Object> data = new HashMap<>();
        data.put("applied", mine != null);
        if (mine != null) {
            data.put("id", mine.getId());
            data.put("shopName", mine.getShopName());
            data.put("shopDesc", mine.getShopDesc());
            data.put("shopLogo", mine.getShopLogo());
            data.put("contactName", mine.getContactName());
            data.put("contactPhone", mine.getContactPhone());
            data.put("registerType", mine.getRegisterType());
            data.put("companyName", mine.getCompanyName());
            data.put("province", mine.getProvince());
            data.put("city", mine.getCity());
            data.put("district", mine.getDistrict());
            data.put("address", mine.getAddress());
            data.put("grade", mine.getGrade());
            data.put("auditStatus", mine.getAuditStatus());
            data.put("auditOpinion", mine.getAuditOpinion());
            data.put("auditTime", mine.getAuditTime());
        }
        // 渠道能力：审核通过才具备（判定依据只在本库，不进核心能力清单）
        data.put("capability", CapabilityCodes.S2B2C_CHANNEL);
        data.put("capabilityGranted", mine != null && "APPROVED".equalsIgnoreCase(mine.getAuditStatus()));
        return ResponseEntity.ok(data);
    }

    @PostMapping("/apply")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody ChannelPartner partner) {
        // 入驻绑定当前账号；一个账号只保留一份渠道档案，避免重复提交产生多条
        ChannelPartner existing = channelIdentityService.currentOrNull();
        String inviteCode = partner.getInviteCode() == null ? "" : partner.getInviteCode().trim();
        if (!inviteCode.isEmpty()) {
            try {
                recruitService.validate(inviteCode);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
            }
        }
        if (existing != null) {
            String auditStatus = existing.getAuditStatus() == null ? "" : existing.getAuditStatus();
            if ("REJECTED".equalsIgnoreCase(auditStatus)) {
                partner.setId(existing.getId());
                boolean success = channelPartnerService.reapply(partner);
                return ResponseEntity.ok(Map.of("success", success,
                        "message", success ? "已重新提交渠道入驻申请，等待审核" : "重新提交失败"));
            }
            String message = "APPROVED".equalsIgnoreCase(auditStatus)
                    ? "已入驻渠道，无需重复申请" : "渠道入驻申请正在审核中";
            return ResponseEntity.ok(Map.of("success", false, "message", message));
        }
        partner.setUserId(SecurityUtils.getUserId());
        Map<String, Object> result = new HashMap<>();
        boolean success = channelPartnerService.apply(partner);
        if (success && !inviteCode.isEmpty()) {
            ChannelPartner created = channelIdentityService.currentOrNull();
            if (created != null) {
                recruitService.bindAfterApply(inviteCode, created.getId());
            }
        }
        result.put("success", success);
        result.put("message", success ? "申请提交成功，等待审核" : "申请提交失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<ChannelPartnerVO> getDetail(@PathVariable Long id) {
        channelIdentityService.requireOwnChannel(id);
        return ResponseEntity.ok(channelPartnerService.getById(id));
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam Long channelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        channelIdentityService.requireApprovedChannel(channelId);
        return ResponseEntity.ok(channelPartnerService.getSelectedProducts(channelId, page, size));
    }

    @GetMapping("/product-pool")
    public ResponseEntity<IPage<ProductVO>> getProductPool(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId) {
        IPage<ProductVO> result = productService.pageList(page, size, keyword, categoryId, null, "APPROVED");
        List<Long> productIds = result.getRecords().stream().map(ProductVO::getId)
                .filter(java.util.Objects::nonNull).toList();
        Map<Long, List<String>> regions = distributionRuleService.regionsFor(productIds);
        for (ProductVO vo : result.getRecords()) {
            vo.setRegionNames(regions.getOrDefault(vo.getId(), List.of()));
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/select-product")
    public ResponseEntity<Map<String, Object>> selectProduct(
            @RequestParam Long channelId,
            @RequestParam Long productId) {
        channelIdentityService.requireApprovedChannel(channelId);
        Map<String, Object> result = new HashMap<>();
        try {
            boolean success = channelPartnerService.selectProduct(channelId, productId);
            result.put("success", success);
            result.put("message", success ? "选品成功" : "选品失败");
        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/commissions")
    public ResponseEntity<IPage<CommissionVO>> getCommissions(
            @RequestParam Long channelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        channelIdentityService.requireApprovedChannel(channelId);
        return ResponseEntity.ok(channelPartnerService.getCommissions(channelId, page, size, status));
    }

    @GetMapping("/total-commission")
    public ResponseEntity<Map<String, Object>> getTotalCommission(@RequestParam Long channelId) {
        channelIdentityService.requireApprovedChannel(channelId);
        Map<String, Object> result = new HashMap<>();
        BigDecimal total = channelPartnerService.getTotalCommission(channelId);
        result.put("total", total);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody ChannelPartner partner) {
        channelIdentityService.requireOwnChannel(partner.getId());
        partner.setUserId(SecurityUtils.getUserId());
        Map<String, Object> result = new HashMap<>();
        boolean success = channelPartnerService.updateInfo(partner);
        result.put("success", success);
        result.put("message", success ? "信息更新成功" : "信息更新失败");
        return ResponseEntity.ok(result);
    }
}
