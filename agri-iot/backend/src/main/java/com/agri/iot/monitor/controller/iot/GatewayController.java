package com.agri.monitor.controller.iot;

import com.agri.monitor.dto.GatewayPageDTO;
import com.agri.monitor.dto.GatewaySaveDTO;
import com.agri.monitor.dto.GatewayVO;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IGatewayService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/iot/gateway")
@RequiredArgsConstructor
@Tag(name = "网关管理")
public class GatewayController {

    private final IGatewayService gatewayService;

    @GetMapping("/page")
    @Operation(summary = "网关分页列表")
    public Result<Page<GatewayVO>> page(GatewayPageDTO dto) {
        return gatewayService.page(dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "网关详情")
    public Result<GatewayVO> detail(@PathVariable Long id) {
        return gatewayService.detail(id);
    }

    @PostMapping
    @Operation(summary = "添加网关")
    public Result<Void> save(@RequestBody GatewaySaveDTO dto) {
        return gatewayService.save(dto);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新网关")
    public Result<Void> update(@PathVariable Long id, @RequestBody GatewaySaveDTO dto) {
        return gatewayService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除网关")
    public Result<Void> delete(@PathVariable Long id) {
        return gatewayService.delete(id);
    }

    @PostMapping("/{id}/heartbeat")
    @Operation(summary = "网关心跳")
    public Result<Void> heartbeat(@PathVariable Long id) {
        return gatewayService.heartbeat(id);
    }
}
