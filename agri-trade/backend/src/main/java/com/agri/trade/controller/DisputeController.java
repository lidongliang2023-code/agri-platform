package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/dispute")
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeMapper disputeMapper;
    private final TradeOrderMapper orderMapper;
    private final PlatformIdentityService identityService;

    @GetMapping("/page")
    public ApiResponse<IPage<Dispute>> getDisputePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String disputeStatus) {
        // 与订单列表同一口径：范围由服务端从令牌推导，前端不再自报参与方。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Page<Dispute> page = new Page<>(pageNum, pageSize);
        if (!scope.hasBinding()) {
            // 没绑定主体 -> 空页（真的没有"与我有关"的纠纷），而不是全平台纠纷。
            return ApiResponse.success(page);
        }
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        List<Long> mine = scope.merchantIds();
        wrapper.and(w -> w.in(Dispute::getComplainantId, mine).or().in(Dispute::getRespondentId, mine));
        if (orderId != null) wrapper.eq(Dispute::getOrderId, orderId);
        if (disputeStatus != null) wrapper.eq(Dispute::getDisputeStatus, disputeStatus);
        wrapper.orderByDesc(Dispute::getCreateTime);
        return ApiResponse.success(disputeMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Dispute> getDisputeById(@PathVariable Long id) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");
        String denied = denyIfNotParticipant(dispute);
        if (denied != null) return ApiResponse.error(denied);
        return ApiResponse.success(dispute);
    }

    @PostMapping
    public ApiResponse<Boolean> createDispute(@RequestBody Dispute dispute) {
        // 申请人必须是自己的主体：原先直接采信请求体里的 complainantId，
        // 等于谁都能以别人名义发起纠纷、把别人的订单拖进争议状态。
        PlatformIdentityService.MerchantSelection mine = identityService.selectMerchant(dispute.getComplainantId());
        if (!mine.ok()) {
            return ApiResponse.error(mine.error());
        }
        dispute.setComplainantId(mine.merchantId());
        if (dispute.getComplainantName() == null || dispute.getComplainantName().isEmpty()) {
            dispute.setComplainantName(mine.merchantName());
        }
        dispute.setDisputeNo("DS" + System.currentTimeMillis());
        dispute.setDelFlag(0);
        dispute.setDisputeStatus("pending");
        dispute.setProcessStage("complain");
        dispute.setCreateTime(new Date());
        dispute.setUpdateTime(new Date());
        
        int result = disputeMapper.insert(dispute);
        if (result > 0) {
            TradeOrder order = orderMapper.selectById(dispute.getOrderId());
            if (order != null) {
                order.setOrderStatus("in_dispute");
                order.setDisputeId(dispute.getId());
                orderMapper.updateById(order);
            }
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/mediation")
    public ApiResponse<Boolean> mediationDispute(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");

        dispute.setProcessStage("mediation");
        dispute.setMediator(params.get("mediator"));
        dispute.setMediationTime(new Date());
        dispute.setMediationResult(params.get("result"));
        dispute.setUpdateTime(new Date());
        
        if ("agreed".equals(params.get("result"))) {
            dispute.setDisputeStatus("resolved");
            dispute.setCloseTime(new Date());
            dispute.setCloseReason("调解达成一致");
        } else {
            dispute.setProcessStage("arbitration");
        }

        int result = disputeMapper.updateById(dispute);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("调解失败");
    }

    @PostMapping("/{id}/arbitration")
    public ApiResponse<Boolean> arbitrationDispute(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");

        dispute.setProcessStage("arbitration");
        dispute.setArbitrator((String) params.get("arbitrator"));
        dispute.setArbitrationTime(new Date());
        dispute.setArbitrationResult((String) params.get("result"));
        dispute.setDisputeStatus("resolved");
        dispute.setCloseTime(new Date());
        dispute.setCloseReason("仲裁结束");
        dispute.setUpdateTime(new Date());

        int result = disputeMapper.updateById(dispute);
        if (result > 0) {
            TradeOrder order = orderMapper.selectById(dispute.getOrderId());
            if (order != null) {
                order.setOrderStatus("completed");
                orderMapper.updateById(order);
            }
            return ApiResponse.success(true);
        }
        return ApiResponse.error("仲裁失败");
    }

    /**
     * 判权：当前用户的主体必须是这单纠纷的申请人或被申请人。
     *
     * @return 拒绝原因；允许访问时返回 null
     */
    private String denyIfNotParticipant(Dispute dispute) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (!scope.hasBinding()) {
            return "当前账号还没有绑定经营主体，看不到相关单据（请联系运营在「用户-主体绑定」里配置）";
        }
        List<Long> mine = scope.merchantIds();
        if (mine.contains(dispute.getComplainantId()) || mine.contains(dispute.getRespondentId())) {
            return null;
        }
        return "无权查看该纠纷";
    }
}
