package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Pledge;
import com.agri.finance.entity.WarehouseReceipt;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.PledgeServiceImpl;
import com.agri.finance.service.impl.WarehouseReceiptServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/pledge")
public class PledgeController {

    private final PledgeServiceImpl pledgeService;
    private final WarehouseReceiptServiceImpl receiptService;
    private final FinanceIdentityService identityService;

    public PledgeController(PledgeServiceImpl pledgeService,
                            WarehouseReceiptServiceImpl receiptService,
                            FinanceIdentityService identityService) {
        this.pledgeService = pledgeService;
        this.receiptService = receiptService;
        this.identityService = identityService;
    }

    /**
     * 发起质押（按仓单）。
     *
     * <p>融资主体由令牌解析，不接前端传来的 userId —— 原来前端自报主体号，
     * 换成别人的号就能把别人的仓单押出去。</p>
     */
    @PostMapping("/create")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> createPledge(@RequestBody Pledge pledge) {
        if (pledge == null) {
            return Map.of("code", 400, "message", "缺少质押申请内容", "data", "");
        }
        return Map.of("code", 200, "message", "success", "data", pledgeService.createPledge(pledge));
    }

    @GetMapping("/list")
    public Map<String, Object> getPledges(@RequestParam(defaultValue = "") String userId,
                                          @RequestParam(defaultValue = "") String status) {
        LambdaQueryWrapper<Pledge> query = new LambdaQueryWrapper<>();
        query.eq(Pledge::getDelFlag, 0);
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            query.eq(Pledge::getUserId, scope);
        }
        if (!status.isBlank()) {
            query.eq(Pledge::getStatus, status.trim());
        }
        query.orderByDesc(Pledge::getCreatedAt);
        List<Pledge> pledges = pledgeService.list(query);
        withReceipt(pledges);
        return Map.of("code", 200, "message", "success", "data", pledges);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getPledge(@PathVariable String id) {
        Pledge pledge = pledgeService.getById(id);
        if (pledge == null) {
            return Map.of("code", 404, "message", "质押记录不存在", "data", "");
        }
        identityService.assertBorrowerOwns(pledge.getUserId());
        withReceipt(List.of(pledge));
        return Map.of("code", 200, "message", "success", "data", pledge);
    }

    @PostMapping("/approve")
    @OperatorOnly("finance:admin")
    public Map<String, Object> approvePledge(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        if (id == null || id.isBlank()) {
            return Map.of("code", 400, "message", "缺少质押编号", "data", "");
        }
        return Map.of("code", 200, "message", "质押已生效", "data", pledgeService.approvePledge(id));
    }

    @PostMapping("/release")
    @OperatorOnly("finance:admin")
    public Map<String, Object> releasePledge(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        if (id == null || id.isBlank()) {
            return Map.of("code", 400, "message", "缺少质押编号", "data", "");
        }
        return Map.of("code", 200, "message", "质押已释放", "data", pledgeService.releasePledge(id));
    }

    /** 质押列表要能看出"押的是哪张仓单、哪个批次"，单号在仓单表上，这里按 id 批量补齐。 */
    private void withReceipt(List<Pledge> pledges) {
        Set<String> receiptIds = new LinkedHashSet<>();
        for (Pledge pledge : pledges) {
            if (pledge.getReceiptId() != null && !pledge.getReceiptId().isBlank()) {
                receiptIds.add(pledge.getReceiptId());
            }
        }
        if (receiptIds.isEmpty()) {
            return;
        }
        Map<String, WarehouseReceipt> byId = receiptService.listByIds(receiptIds).stream()
                .collect(java.util.stream.Collectors.toMap(WarehouseReceipt::getId, item -> item, (a, b) -> a));
        for (Pledge pledge : pledges) {
            WarehouseReceipt receipt = byId.get(pledge.getReceiptId());
            if (receipt != null) {
                pledge.setReceiptNo(receipt.getReceiptNo());
                pledge.setBatchNo(receipt.getBatchNo());
            }
        }
    }
}
