package com.agri.finance.controller;

import com.agri.finance.entity.FundProvider;
import com.agri.finance.service.impl.FundProviderServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/fund-provider")
public class FundProviderController {

    @Autowired
    private FundProviderServiceImpl fundProviderService;

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody FundProvider provider) {
        FundProvider result = fundProviderService.register(provider);
        return Map.of("code", 200, "message", "注册成功", "data", result);
    }

    @PostMapping("/approve/{id}")
    public Map<String, Object> approve(@PathVariable String id, @RequestParam String reviewerId, @RequestParam(required = false) String opinion) {
        FundProvider result = fundProviderService.approve(id, reviewerId, opinion);
        return Map.of("code", 200, "message", "审批通过", "data", result);
    }

    @PostMapping("/reject/{id}")
    public Map<String, Object> reject(@PathVariable String id, @RequestParam String reviewerId, @RequestParam(required = false) String opinion) {
        FundProvider result = fundProviderService.reject(id, reviewerId, opinion);
        return Map.of("code", 200, "message", "已拒绝", "data", result);
    }

    @GetMapping("/pending-review")
    public Map<String, Object> getPendingReview() {
        List<FundProvider> providers = fundProviderService.getPendingReview();
        return Map.of("code", 200, "message", "success", "data", providers);
    }

    @GetMapping("/active")
    public Map<String, Object> getActiveProviders() {
        List<FundProvider> providers = fundProviderService.getActiveProviders();
        return Map.of("code", 200, "message", "success", "data", providers);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getProviderDetail(@PathVariable String id) {
        FundProvider provider = fundProviderService.getById(id);
        return Map.of("code", 200, "message", "success", "data", provider);
    }
}