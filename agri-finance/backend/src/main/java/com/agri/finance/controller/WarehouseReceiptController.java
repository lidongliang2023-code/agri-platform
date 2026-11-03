package com.agri.finance.controller;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.PledgeMonitor;
import com.agri.finance.entity.WarehouseReceipt;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.WarehouseReceiptServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 仓单接口（融资方开单、运营核单）。
 *
 * <p>读接口按令牌解析出的主体收范围：融资方只会看到自己的仓单，
 * 运营不传 userId 时看到全量台账（核对质押物是否重复担保）。
 * 批次与存证都实时读生产域，所以这里没有"手工录入仓单"的入口。</p>
 */
@RestController
@RequestMapping("/api/v1/warehouse-receipt")
public class WarehouseReceiptController {

    private final WarehouseReceiptServiceImpl receiptService;
    private final FinanceIdentityService identityService;

    public WarehouseReceiptController(WarehouseReceiptServiceImpl receiptService,
                                      FinanceIdentityService identityService) {
        this.receiptService = receiptService;
        this.identityService = identityService;
    }

    /** 可开仓单的批次（当前主体已入库的采收批次）。 */
    @GetMapping("/batches")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> batches() {
        return ok(receiptService.candidateBatches());
    }

    /** 开单前核对：批次、分仓库存、在库可用量、区块链存证、已有仓单。 */
    @GetMapping("/batch-preview")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> batchPreview(@RequestParam String batchId) {
        return ok(receiptService.batchPreview(batchId));
    }

    /** 按批次生成仓单。品类/数量上限/存证都由服务端从生产域核对，不接受前端自报。 */
    @PostMapping("/create")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> create(@RequestBody Map<String, Object> form) {
        return ok(receiptService.createFromBatch(form == null ? Map.of() : form));
    }

    @GetMapping("/list")
    public Map<String, Object> list(@RequestParam(defaultValue = "") String userId,
                                    @RequestParam(defaultValue = "") String status) {
        LambdaQueryWrapper<WarehouseReceipt> query = new LambdaQueryWrapper<>();
        query.eq(WarehouseReceipt::getDelFlag, 0);
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            query.eq(WarehouseReceipt::getUserId, scope);
        }
        if (!status.isBlank()) {
            query.eq(WarehouseReceipt::getStatus, status.trim());
        }
        query.orderByDesc(WarehouseReceipt::getCreatedAt);
        return ok(receiptService.list(query));
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable String id) {
        WarehouseReceipt receipt = require(id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("receipt", receipt);
        data.put("monitor", receiptService.latestMonitor(receipt.getId()));
        return ok(data);
    }

    /** 仓储监控快照：读库里最近一次（页面默认走这条，不重复打生产域）。 */
    @GetMapping("/{id}/monitor")
    public Map<String, Object> monitor(@PathVariable String id) {
        WarehouseReceipt receipt = require(id);
        PledgeMonitor monitor = receiptService.latestMonitor(receipt.getId());
        return ok(monitor == null ? Map.of() : monitor);
    }

    /** 现场拉一次生产域读数并存成新快照（温湿度实时、重量与气体浓度本部署没有采集通道）。 */
    @PostMapping("/{id}/monitor/refresh")
    public Map<String, Object> refreshMonitor(@PathVariable String id) {
        return ok(receiptService.refreshMonitor(id));
    }

    private WarehouseReceipt require(String id) {
        WarehouseReceipt receipt = receiptService.getById(id);
        if (receipt == null || Integer.valueOf(1).equals(receipt.getDelFlag())) {
            throw new BusinessException(404, "仓单不存在");
        }
        identityService.assertBorrowerOwns(receipt.getUserId());
        return receipt;
    }

    private Map<String, Object> ok(Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", 200);
        body.put("message", "success");
        body.put("data", data);
        return body;
    }
}
