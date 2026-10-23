package com.agri.finance.controller;

import com.agri.finance.entity.Blacklist;
import com.agri.finance.service.impl.BlacklistServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/blacklist")
public class BlacklistController {

    private final BlacklistServiceImpl blacklistService;

    public BlacklistController(BlacklistServiceImpl blacklistService) {
        this.blacklistService = blacklistService;
    }

    @PostMapping("/add")
    public Map<String, Object> addToBlacklist(@RequestBody Blacklist blacklist) {
        Blacklist result = blacklistService.addToBlacklist(blacklist);
        return Map.of("code", 200, "message", "success", "data", result);
    }

    @GetMapping("/list")
    public Map<String, Object> getBlacklist(@RequestParam(defaultValue = "") String listType) {
        LambdaQueryWrapper<Blacklist> query = new LambdaQueryWrapper<>();
        query.eq(Blacklist::getDelFlag, 0);
        if (!listType.isEmpty()) {
            query.eq(Blacklist::getListType, listType);
        }
        var list = blacklistService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getBlacklistItem(@PathVariable String id) {
        Blacklist item = blacklistService.getById(id);
        return Map.of("code", 200, "message", "success", "data", item);
    }

    @PostMapping("/approve")
    public Map<String, Object> approveBlacklist(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        String reviewerId = request.get("reviewerId");
        String reviewerName = request.get("reviewerName");
        Blacklist item = blacklistService.approveBlacklist(id, reviewerId, reviewerName);
        return Map.of("code", 200, "message", "success", "data", item);
    }

    @PostMapping("/remove")
    public Map<String, Object> removeFromBlacklist(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Blacklist item = blacklistService.removeFromBlacklist(id);
        return Map.of("code", 200, "message", "success", "data", item);
    }

    @PostMapping("/check")
    public Map<String, Object> checkBlacklist(@RequestBody Map<String, String> request) {
        String userId = request.get("userId");
        LambdaQueryWrapper<Blacklist> query = new LambdaQueryWrapper<>();
        query.eq(Blacklist::getUserId, userId)
             .eq(Blacklist::getDelFlag, 0)
             .eq(Blacklist::getReviewStatus, "已通过")
             .isNull(Blacklist::getRemovedTime);
        boolean inBlacklist = blacklistService.count(query) > 0;
        return Map.of("code", 200, "message", "success", "data", inBlacklist);
    }
}