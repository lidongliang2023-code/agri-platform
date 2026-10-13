package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;

@RestController
@RequestMapping("/api/trade/dispute")
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeMapper disputeMapper;
    private final TradeOrderMapper orderMapper;

    @GetMapping("/page")
    public ApiResponse<IPage<Dispute>> getDisputePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String disputeStatus,
            // 参与方范围：申请人或被申请人。用户端必须传其中之一，见下面守卫。
            @RequestParam(required = false) Long participantId,
            @RequestParam(required = false) Long complainantId,
            @RequestParam(required = false) Long respondentId) {
        Page<Dispute> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        // 与订单同理：原先不传任何范围就返回全平台纠纷 —— 买家能看到别人的纠纷单。
        // 全平台查询归运营端（/admin/trade/dispute/page）。这里改成"必须给出范围"。
        // 平台上目前还没有"用户 ↔ 经营主体"的映射，所以用户端传自己的用户 id 会查不到数据；
        // 那是**正确**结果（查不到 ≠ 看得到别人的），映射建好后再把口径接上。
        if (participantId == null && complainantId == null && respondentId == null) {
            return ApiResponse.error("查询纠纷必须指定参与方（participantId）或申请人/被申请人；全平台查询请使用运营端接口");
        }
        if (participantId != null) {
            Long pid = participantId;
            wrapper.and(w -> w.eq(Dispute::getComplainantId, pid).or().eq(Dispute::getRespondentId, pid));
        }
        if (complainantId != null) wrapper.eq(Dispute::getComplainantId, complainantId);
        if (respondentId != null) wrapper.eq(Dispute::getRespondentId, respondentId);
        if (orderId != null) wrapper.eq(Dispute::getOrderId, orderId);
        if (disputeStatus != null) wrapper.eq(Dispute::getDisputeStatus, disputeStatus);
        wrapper.orderByDesc(Dispute::getCreateTime);
        return ApiResponse.success(disputeMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Dispute> getDisputeById(@PathVariable Long id) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");
        return ApiResponse.success(dispute);
    }

    @PostMapping
    public ApiResponse<Boolean> createDispute(@RequestBody Dispute dispute) {
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
}
