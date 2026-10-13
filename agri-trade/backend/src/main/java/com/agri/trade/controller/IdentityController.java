package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.PlatformIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 「我的经营主体」—— 给前端把身份显式画出来。
 *
 * <p>为什么要单独给一个接口：订单/纠纷列表改成服务端推导范围后，"查不到数据"有两种原因 ——
 * 真的没有单据，和**账号根本没绑定主体**。两者如果都只表现为一张空表，
 * 就成了这个项目反复踩的"看起来过滤了、其实永远为空"。页面拿到这份主体清单后，
 * 至少能明确告诉用户"你当前以 XX 合作社（owner）的身份在看"。</p>
 */
@RestController
@RequestMapping("/api/trade/identity")
@RequiredArgsConstructor
public class IdentityController {

    private final PlatformIdentityService platformIdentityService;

    @GetMapping("/my-merchants")
    public ApiResponse<List<Map<String, Object>>> myMerchants() {
        PlatformIdentityService.MerchantScope scope = platformIdentityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(scope.bindings());
    }
}
