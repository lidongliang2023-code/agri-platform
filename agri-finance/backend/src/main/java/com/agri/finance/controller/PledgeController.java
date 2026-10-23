package com.agri.finance.controller;

import com.agri.finance.entity.Pledge;
import com.agri.finance.service.impl.PledgeServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/pledge")
public class PledgeController {

    private final PledgeServiceImpl pledgeService;

    public PledgeController(PledgeServiceImpl pledgeService) {
        this.pledgeService = pledgeService;
    }

    @PostMapping("/create")
    public Map<String, Object> createPledge(@RequestBody Pledge pledge) {
        Pledge result = pledgeService.createPledge(pledge);
        if (result == null) {
            return Map.of("code", 400, "message", "请完整填写融资方、质押物类型、数量和单价", "data", "");
        }
        return Map.of("code", 200, "message", "success", "data", result);
    }

    @GetMapping("/list")
    public Map<String, Object> getPledges(@RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<Pledge> query = new LambdaQueryWrapper<>();
        query.eq(Pledge::getDelFlag, 0);
        if (!userId.isEmpty()) {
            query.eq(Pledge::getUserId, userId);
        }
        var list = pledgeService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getPledge(@PathVariable String id) {
        Pledge pledge = pledgeService.getById(id);
        return Map.of("code", 200, "message", "success", "data", pledge);
    }

    @PostMapping("/approve")
    public Map<String, Object> approvePledge(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Pledge pledge = pledgeService.approvePledge(id);
        return Map.of("code", 200, "message", "success", "data", pledge);
    }

    @PostMapping("/release")
    public Map<String, Object> releasePledge(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Pledge pledge = pledgeService.releasePledge(id);
        return Map.of("code", 200, "message", "success", "data", pledge);
    }
}
