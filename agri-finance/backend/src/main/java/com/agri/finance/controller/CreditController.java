package com.agri.finance.controller;

import com.agri.finance.entity.CreditScore;
import com.agri.finance.service.ICreditScoreService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/credit")
public class CreditController {

    private final ICreditScoreService creditScoreService;

    public CreditController(ICreditScoreService creditScoreService) {
        this.creditScoreService = creditScoreService;
    }

    @GetMapping("/score")
    public Map<String, Object> getCreditScore(@RequestParam String userId) {
        CreditScore score = creditScoreService.generateCreditReport(userId);
        return Map.of("code", 200, "message", "success", "data", score);
    }

    @GetMapping("/score/detail")
    public Map<String, Object> getCreditScoreDetail(@RequestParam String userId) {
        CreditScore score = creditScoreService.generateCreditReport(userId);
        return Map.of("code", 200, "message", "success", "data", score);
    }

    @PostMapping("/evaluate")
    public Map<String, Object> evaluateCredit(@RequestBody Map<String, String> request) {
        String userId = request.get("userId");
        CreditScore score = creditScoreService.generateCreditReport(userId);
        return Map.of("code", 200, "message", "success", "data", score);
    }
}