package com.agri.finance.controller;

import com.agri.finance.entity.CreditReport;
import com.agri.finance.service.impl.CreditReportServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/credit")
public class CreditReportController {

    @Autowired
    private CreditReportServiceImpl creditReportService;

    @GetMapping("/report")
    public Map<String, Object> getReport(@RequestParam String userId) {
        CreditReport report = creditReportService.getReport(userId);
        return Map.of("code", 200, "message", "success", "data", report);
    }

    @PostMapping("/report/generate")
    public Map<String, Object> generateReport(@RequestParam String userId) {
        CreditReport report = creditReportService.generateReport(userId);
        return Map.of("code", 200, "message", "success", "data", report);
    }

    @GetMapping("/report/history")
    public Map<String, Object> getReportHistory(@RequestParam String userId) {
        List<CreditReport> history = creditReportService.getReportHistory(userId);
        return Map.of("code", 200, "message", "success", "data", history);
    }
}