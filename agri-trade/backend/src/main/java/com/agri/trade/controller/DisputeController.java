package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.service.ICompensationService;
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
    private final ICompensationService compensationService;

    @GetMapping("/page")
    public ApiResponse<IPage<Dispute>> getDisputePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String disputeStatus,
            // 列表页的搜索框一直在，但后端从来没收过 disputeNo —— 输了字点搜索没有任何变化。
            @RequestParam(required = false) String disputeNo) {
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
        if (disputeNo != null && !disputeNo.isEmpty()) wrapper.like(Dispute::getDisputeNo, disputeNo);
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
        if (dispute.getOrderId() == null) {
            return ApiResponse.error("必须指定关联订单");
        }
        TradeOrder order = orderMapper.selectById(dispute.getOrderId());
        if (order == null) {
            return ApiResponse.error("订单不存在");
        }
        Long me = mine.merchantId();
        // 只能对"自己参与的订单"发起纠纷。原先不校验订单归属 —— 任何人都能
        // 拿一个不相干的订单号发起纠纷，把自己的当事人身份挂到别人的单子上。
        if (!me.equals(order.getBuyerId()) && !me.equals(order.getSellerId())) {
            return ApiResponse.error("只能对自己参与的订单发起纠纷");
        }
        // 一单一条未结纠纷：否则同一张订单被反复发起，运营端面对一堆重复案件，
        // 每一条都能各自走到仲裁，结论还可能互相矛盾。
        Long open = disputeMapper.selectCount(new LambdaQueryWrapper<Dispute>()
                .eq(Dispute::getOrderId, order.getId())
                .in(Dispute::getDisputeStatus, List.of("pending", "processing"))
                .eq(Dispute::getDelFlag, 0));
        if (open != null && open > 0) {
            return ApiResponse.error("该订单已有一条未结纠纷，请等它处理完再发起");
        }

        dispute.setComplainantId(me);
        if (dispute.getComplainantName() == null || dispute.getComplainantName().isEmpty()) {
            dispute.setComplainantName(mine.merchantName());
        }
        // 被申请人由订单的对侧推导，不采信请求体 —— 否则可以把任何不相干的主体
        // 拖进纠纷（表里 respondent_id 还是 NOT NULL，漏填就直接插入失败）。
        if (me.equals(order.getBuyerId())) {
            dispute.setComplainantType("buyer");
            dispute.setRespondentId(order.getSellerId());
            dispute.setRespondentName(order.getSellerName());
        } else {
            dispute.setComplainantType("seller");
            dispute.setRespondentId(order.getBuyerId());
            dispute.setRespondentName(order.getBuyerName());
        }
        if (dispute.getOrderNo() == null || dispute.getOrderNo().isEmpty()) {
            dispute.setOrderNo(order.getOrderNo());
        }
        dispute.setDisputeNo("DS" + System.currentTimeMillis());
        dispute.setDelFlag(0);
        dispute.setDisputeStatus("pending");
        dispute.setProcessStage("complain");
        dispute.setCreateTime(new Date());
        dispute.setUpdateTime(new Date());
        
        int result = disputeMapper.insert(dispute);
        if (result > 0) {
            // 只记下"这单正在争议中"，**不改订单自己的状态**。
            // 原先把订单置成 in_dispute —— 那个取值不在订单状态词表里（前端只会渲染成灰标签原文），
            // 而且会把订单的生命周期位置（已付款/已发货）直接抹掉。
            // 争议的进度有自己的 dispute_status 与 process_stage，不该覆盖订单状态。
            order.setDisputeId(dispute.getId());
            orderMapper.updateById(order);
            return ApiResponse.success(true);
        }
        return ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/mediation")
    @com.agri.trade.common.security.OperatorOnly
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
            // 转入仲裁 = 案件已经有人在办了，不再是"待受理"。
            // 原先只改 process_stage、状态还是 pending，运营端按"未结"筛的时候
            // 这些已经在仲裁里的案子会被当成待受理，与大盘数字对不上。
            dispute.setDisputeStatus("processing");
            dispute.setProcessStage("arbitration");
        }

        int result = disputeMapper.updateById(dispute);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("调解失败");
    }

    @PostMapping("/{id}/arbitration")
    @com.agri.trade.common.security.OperatorOnly
    public ApiResponse<Boolean> arbitrationDispute(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");

        String arbitrationResult = (String) params.get("result");
        dispute.setProcessStage("arbitration");
        dispute.setArbitrator((String) params.get("arbitrator"));
        dispute.setArbitrationTime(new Date());
        dispute.setArbitrationResult(arbitrationResult);
        dispute.setDisputeStatus("resolved");
        dispute.setCloseTime(new Date());
        dispute.setCloseReason("仲裁结束");
        dispute.setUpdateTime(new Date());

        int result = disputeMapper.updateById(dispute);
        // 仲裁判了"支持申请人/部分支持" = 平台认下了要赔钱这件事，
        // 这里落一张**待审核**的赔付单，接着走赔付执行页的"核准 → 打款"两步。
        //
        // 为什么必须由系统生成：创建赔付单的接口（POST /api/trade/compensation）
        // 在整份前端里一次都没被调用过 —— 赔付执行页只有"核准/打款"，
        // 于是仲裁判赔之后，赔付单只能靠人工写库，或者干脆就没人赔。
        // 金额：全额支持取索赔金额；部分支持由仲裁传入 compensationAmount。
        // 注意：这里的 result 是 updateById 的影响行数（int），裁定结论在 arbitrationResult 里。
        // 别写成 "uphold".equals(result) —— String.equals(Integer) 不报错、恒为 false，
        // 表现就是"这段代码明明在、却从来没生效过"。
        if ("uphold".equals(arbitrationResult) || "partial".equals(arbitrationResult)) {
            java.math.BigDecimal award = toAmount(params.get("compensationAmount"));
            if (award == null) {
                award = dispute.getCompensationAmount() != null ? dispute.getCompensationAmount() : dispute.getClaimAmount();
            }
            if (award != null && award.compareTo(java.math.BigDecimal.ZERO) > 0) {
                compensationService.createCompensation(
                        dispute.getOrderId(),
                        dispute.getId(),
                        dispute.getDisputeType() == null ? "dispute" : dispute.getDisputeType(),
                        award,
                        dispute.getComplainantId(),
                        dispute.getComplainantName());
            }
        }
        // 仲裁结论只落在纠纷单上。原先这里还会把订单状态改成 completed ——
        // 那是把"争议结束"误当成"订单走完了"，等于替买卖双方把订单结算掉。
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("仲裁失败");
    }

    /** 从请求体里取一个金额（可能是 Number，也可能是字符串），取不到返回 null。 */
    private java.math.BigDecimal toAmount(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return new java.math.BigDecimal(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 当事人自行了结纠纷（和解 / 撤诉）。
     *
     * <p>与运营端 mediation / arbitration 的区别：那两个是第三方介入后给出结论，
     * 这里是当事双方自己谈拢了，不需要运营经手。原先前端 api/dispute.ts 里写好了
     * resolveDispute，页面上也有"处理"按钮，但后端没有这个路径 —— 点下去只能 404。</p>
     *
     * <p>权限：必须是自己参与的纠纷（沿用与详情同一套判权口径），
     * 否则任何人都能替别人把纠纷"了结"掉。</p>
     */
    @PostMapping("/{id}/resolve")
    public ApiResponse<Boolean> resolveDispute(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        Dispute dispute = disputeMapper.selectById(id);
        if (dispute == null) return ApiResponse.error("纠纷不存在");
        String denied = denyIfNotParticipant(dispute);
        if (denied != null) return ApiResponse.error(denied);
        if ("resolved".equals(dispute.getDisputeStatus()) || "closed".equals(dispute.getDisputeStatus())) {
            return ApiResponse.error("该纠纷已经了结，不能重复处理");
        }

        String result = params.get("result");
        String remark = params.get("remark");
        dispute.setDisputeStatus("resolved");
        dispute.setProcessStage("resolved");
        dispute.setMediationResult(result);
        dispute.setCloseTime(new Date());
        dispute.setCloseReason(switch (result == null ? "" : result) {
            case "agreed" -> "双方自行达成和解";
            case "withdrawn" -> "申请人撤回";
            default -> "当事人了结";
        });
        if (remark != null && !remark.isEmpty()) {
            dispute.setRemark(remark);
        }
        dispute.setUpdateTime(new Date());

        int updated = disputeMapper.updateById(dispute);
        return updated > 0 ? ApiResponse.success(true) : ApiResponse.error("处理失败");
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
