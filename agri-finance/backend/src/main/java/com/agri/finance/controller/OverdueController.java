package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.job.RepaymentOverdueScanner;
import com.agri.finance.service.ICreditScoreService;
import com.agri.finance.service.impl.OverdueRecordServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/overdue")
@OperatorOnly("finance:admin")
public class OverdueController {

    private final OverdueRecordServiceImpl overdueRecordService;
    private final RepaymentOverdueScanner overdueScanner;
    private final ICreditScoreService creditScoreService;

    public OverdueController(OverdueRecordServiceImpl overdueRecordService,
                             RepaymentOverdueScanner overdueScanner,
                             ICreditScoreService creditScoreService) {
        this.overdueRecordService = overdueRecordService;
        this.overdueScanner = overdueScanner;
        this.creditScoreService = creditScoreService;
    }

    @GetMapping("/list")
    public Map<String, Object> getOverdueRecords(@RequestParam(defaultValue = "") String status,
                                                 @RequestParam(defaultValue = "") String stage,
                                                 @RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<OverdueRecord> query = new LambdaQueryWrapper<>();
        query.eq(OverdueRecord::getDelFlag, 0);
        if (!status.isEmpty()) {
            query.eq(OverdueRecord::getStatus, status);
        }
        if (!stage.isEmpty()) {
            query.eq(OverdueRecord::getOverdueStage, stage);
        }
        if (!userId.isEmpty()) {
            query.eq(OverdueRecord::getUserId, userId);
        }
        query.orderByDesc(OverdueRecord::getOverdueDate);
        var list = overdueRecordService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    /** 手动触发到期扫描（与每日 03:10 的定时任务同一份逻辑）。 */
    @PostMapping("/scan")
    public Map<String, Object> scan() {
        return Map.of("code", 200, "message", "扫描完成",
                "data", Map.of("registered", overdueScanner.scan()));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getOverdueRecord(@PathVariable String id) {
        OverdueRecord record = overdueRecordService.getById(id);
        if (record == null) {
            return Map.of("code", 404, "message", "逾期记录不存在", "data", "");
        }
        return Map.of("code", 200, "message", "success", "data", record);
    }

    @PostMapping("/assign")
    public Map<String, Object> assignCollector(@RequestBody Map<String, String> request) {
        OverdueRecord record = overdueRecordService.assignCollector(
                request.get("id"), request.get("collectorId"), request.get("collectorName"));
        return Map.of("code", 200, "message", "催收已分配", "data", record);
    }

    /** 台账关闭后必须重算授信，否则扣掉的分不会回来。 */
    @PostMapping("/paid")
    public Map<String, Object> markPaid(@RequestBody Map<String, String> request) {
        OverdueRecord record = overdueRecordService.markPaid(request.get("id"));
        creditScoreService.generateCreditReport(record.getUserId());
        return Map.of("code", 200, "message", "逾期已结清", "data", record);
    }
}
