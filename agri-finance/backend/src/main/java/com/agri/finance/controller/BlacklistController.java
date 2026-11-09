package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Blacklist;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.BlacklistServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/blacklist")
@OperatorOnly("finance:admin")
public class BlacklistController {

    private final BlacklistServiceImpl blacklistService;
    private final FinanceIdentityService identityService;

    public BlacklistController(BlacklistServiceImpl blacklistService,
                               FinanceIdentityService identityService) {
        this.blacklistService = blacklistService;
        this.identityService = identityService;
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
        if (item == null || Integer.valueOf(1).equals(item.getDelFlag())) {
            return Map.of("code", 404, "message", "黑名单记录不存在", "data", "");
        }
        return Map.of("code", 200, "message", "success", "data", item);
    }

    @PostMapping("/approve")
    public Map<String, Object> approveBlacklist(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Blacklist item = blacklistService.approveBlacklist(id,
                identityService.currentOperatorId(), identityService.currentOperatorName());
        return Map.of("code", 200, "message", "复核完成", "data", item);
    }

    @PostMapping("/remove")
    public Map<String, Object> removeFromBlacklist(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Blacklist item = blacklistService.removeFromBlacklist(id);
        return Map.of("code", 200, "message", "已解除", "data", item);
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
