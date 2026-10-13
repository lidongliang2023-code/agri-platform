package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeConfig;
import com.agri.trade.service.TradeConfigService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 系统配置（运营端）。
 *
 * <p>只暴露"真的有代码在读"的配置项。页面上每一项都写明改了会影响什么，
 * 并且会标明取值来源（库里改过 / 用配置文件默认值）。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/config")
@RequiredArgsConstructor
public class AdminConfigController {

    private final TradeConfigService configService;

    @Operation(summary = "配置列表")
    @GetMapping("/list")
    public ApiResponse<List<TradeConfig>> list() {
        return ApiResponse.success(configService.list());
    }

    @Operation(summary = "修改配置")
    @PutMapping("/{key}")
    public ApiResponse<Boolean> update(@PathVariable String key, @RequestBody Map<String, String> params) {
        String error = configService.update(key, params.get("value"));
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }
}
