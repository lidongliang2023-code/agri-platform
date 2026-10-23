package com.agri.finance.controller;

import com.agri.finance.entity.PledgeMonitor;
import com.agri.finance.service.impl.PledgeMonitorServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/pledge-monitor")
public class PledgeMonitorController {

    @Autowired
    private PledgeMonitorServiceImpl pledgeMonitorService;

    @PostMapping("/add")
    public Map<String, Object> addMonitor(@RequestBody PledgeMonitor monitor) {
        PledgeMonitor result = pledgeMonitorService.addMonitor(monitor);
        return Map.of("code", 200, "message", "添加成功", "data", result);
    }

    @GetMapping("/receipt/{receiptId}")
    public Map<String, Object> getMonitorByReceipt(@PathVariable String receiptId) {
        List<PledgeMonitor> monitors = pledgeMonitorService.getMonitorByReceipt(receiptId);
        return Map.of("code", 200, "message", "success", "data", monitors);
    }

    @GetMapping("/latest/{receiptId}")
    public Map<String, Object> getLatestMonitor(@PathVariable String receiptId) {
        PledgeMonitor monitor = pledgeMonitorService.getLatestMonitor(receiptId);
        return Map.of("code", 200, "message", "success", "data", monitor);
    }

    @GetMapping("/alerts")
    public Map<String, Object> getAlertMonitors() {
        List<PledgeMonitor> monitors = pledgeMonitorService.getAlertMonitors();
        return Map.of("code", 200, "message", "success", "data", monitors);
    }

    @PostMapping("/alert/{monitorId}")
    public Map<String, Object> updateAlert(@PathVariable String monitorId, 
                                           @RequestParam String alertLevel, 
                                           @RequestParam String alertContent) {
        pledgeMonitorService.updateAlert(monitorId, alertLevel, alertContent);
        return Map.of("code", 200, "message", "更新成功");
    }
}