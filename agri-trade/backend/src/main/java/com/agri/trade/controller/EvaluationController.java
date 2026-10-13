package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.EvaluationAppeal;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.EvaluationAppealMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/evaluation")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationMapper evaluationMapper;
    private final EvaluationAppealMapper appealMapper;
    private final PlatformIdentityService identityService;
    private final TradeOrderMapper orderMapper;

    @GetMapping("/page")
    public ApiResponse<IPage<Evaluation>> getEvaluationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) Long evaluateeId,
            // 列表页的搜索框与评分下拉一直在，但后端从来没收过这两个参数 —— 输了字、选了星级都没反应。
            @RequestParam(required = false) String evaluationNo,
            @RequestParam(required = false) BigDecimal ratingOverall) {
        Page<Evaluation> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        if (orderId != null) wrapper.eq(Evaluation::getOrderId, orderId);
        if (evaluateeId != null) wrapper.eq(Evaluation::getEvaluateeId, evaluateeId);
        if (evaluationNo != null && !evaluationNo.isEmpty()) {
            wrapper.like(Evaluation::getEvaluationNo, evaluationNo);
        }
        if (ratingOverall != null) wrapper.eq(Evaluation::getRatingOverall, ratingOverall);
        wrapper.orderByDesc(Evaluation::getCreateTime);
        return ApiResponse.success(evaluationMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Evaluation> getEvaluationById(@PathVariable Long id) {
        Evaluation evaluation = evaluationMapper.selectById(id);
        if (evaluation == null) return ApiResponse.error("评价不存在");
        return ApiResponse.success(evaluation);
    }

    @PostMapping
    public ApiResponse<Boolean> createEvaluation(@RequestBody Evaluation evaluation) {
        // 评价是"交易一方对另一方的公开说法"，所以：
        //   ① 只有这笔订单的买卖双方能评价（原先谁都能给任何订单发一条评价）；
        //   ② 评价人与被评价人**由服务端按订单推导**，不采信请求体 ——
        //      否则可以冒用别人的名义评价；
        //   ③ 状态写词表里的 published（原先写的是 show，全库只有这一处这么写，
        //      结果这条评价在信用看板/平均分这类按 published 过滤的地方**根本不算数**）。
        if (evaluation.getOrderId() == null) {
            return ApiResponse.error("请指定要评价的订单");
        }
        TradeOrder order = orderMapper.selectById(evaluation.getOrderId());
        if (order == null) {
            return ApiResponse.error("订单不存在");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Long buyerId = order.getBuyerId();
        Long sellerId = order.getSellerId();
        boolean amBuyer = buyerId != null && scope.merchantIds().contains(buyerId);
        boolean amSeller = sellerId != null && scope.merchantIds().contains(sellerId);
        if (!amBuyer && !amSeller) {
            return ApiResponse.error("只有这笔订单的买卖双方可以评价");
        }
        // 评价人 = 我自己那一方；被评价人 = 对方
        if (amBuyer) {
            evaluation.setEvaluatorId(buyerId);
            evaluation.setEvaluatorName(order.getBuyerName());
            evaluation.setEvaluateeId(sellerId);
            evaluation.setEvaluateeName(order.getSellerName());
        } else {
            evaluation.setEvaluatorId(sellerId);
            evaluation.setEvaluatorName(order.getSellerName());
            evaluation.setEvaluateeId(buyerId);
            evaluation.setEvaluateeName(order.getBuyerName());
        }
        if (evaluation.getRatingOverall() == null) {
            return ApiResponse.error("请给出综合评分");
        }
        // 表上 uk_order_id 只允许一笔订单一条评价：提前给出清楚提示，
        // 而不是让数据库抛唯一键冲突（页面上只会看到"创建失败"）。
        Long exists = evaluationMapper.selectCount(new LambdaQueryWrapper<Evaluation>()
                .eq(Evaluation::getOrderId, evaluation.getOrderId())
                .eq(Evaluation::getDelFlag, 0));
        if (exists != null && exists > 0) {
            return ApiResponse.error("这笔订单已经评价过了");
        }

        evaluation.setEvaluationNo("EV" + System.currentTimeMillis());
        evaluation.setDelFlag(0);
        evaluation.setEvaluationStatus("published");
        evaluation.setCreateTime(new Date());
        evaluation.setUpdateTime(new Date());
        int result = evaluationMapper.insert(evaluation);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}/reply")
    public ApiResponse<Boolean> replyEvaluation(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        Evaluation evaluation = evaluationMapper.selectById(id);
        if (evaluation == null) return ApiResponse.error("评价不存在");

        // 回复是**被评价方的官方回应**：只有被评价的那家主体能回，
        // 否则任何人都能替商家"回"一句（那句话在页面上是挂着商家名的）。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (evaluation.getEvaluateeId() == null
                || scope.nameOf(evaluation.getEvaluateeId()) == null) {
            return ApiResponse.error("只有被评价方可以回复这条评价");
        }

        String content = params.get("content");
        if (content == null || content.trim().isEmpty()) {
            return ApiResponse.error("回复内容不能为空");
        }
        // 只允许回复一次：官方回应被反复改写，买家那边看到的就不是当时的说法了。
        // 需要修改请走申诉/运营介入（留痕）。
        if (evaluation.getReplyContent() != null && !evaluation.getReplyContent().isEmpty()) {
            return ApiResponse.error("这条评价已经回复过了");
        }

        evaluation.setReplyContent(content.trim());
        evaluation.setReplyTime(new Date());
        evaluation.setUpdateTime(new Date());
        int result = evaluationMapper.updateById(evaluation);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("回复失败");
    }

    /**
     * 对一条评价发起申诉。
     *
     * <p>路径从 {@code /appeal} 改成 {@code /{id}/appeal}：前端 api/evaluation.ts
     * 一直是按"评价 id 放路径里"写的（POST /evaluation/{id}/appeal），而后端注册的是
     * POST /appeal（id 放在请求体里）。两边对不上，页面上"申诉"这个动作只能 404。
     * 这里按前端已有的形态改路径 —— 本模块其它子资源动作（/quote/{id}/accept、
     * /order/{id}/pay）也都是这个形状。</p>
     *
     * <p>申诉人由服务端按登录用户绑定的经营主体决定，不采信请求体里的 appellantId：
     * 否则谁都能以别人的名义提申诉，把别人的评价隐藏掉（申诉通过后评价会置 hidden）。</p>
     */
    @PostMapping("/{id}/appeal")
    public ApiResponse<Boolean> appealEvaluation(@PathVariable Long id,
                                                 @RequestBody Map<String, Object> params) {
        Evaluation evaluation = evaluationMapper.selectById(id);
        if (evaluation == null) {
            return ApiResponse.error("评价不存在");
        }
        // 申诉人 = 这条评价的被评价方。这里不能用"让调用方挑一个主体"那套：
        // 申诉人是由**单据本身**决定的（只有一个正确答案），而用户可能绑定多家主体，
        // 让他去挑反而会把"我该以哪家身份说这话"这种问题推给前端。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        String appellantName = scope.nameOf(evaluation.getEvaluateeId());
        if (appellantName == null) {
            return ApiResponse.error("你无权对这条评价发起申诉（只有被评价方可以）");
        }

        EvaluationAppeal appeal = new EvaluationAppeal();
        appeal.setEvaluationId(id);
        appeal.setAppealNo("AP" + System.currentTimeMillis());
        appeal.setAppealType(str(params.get("appealType")));
        appeal.setAppealReason(str(params.get("appealReason")));
        appeal.setAppealEvidence(str(params.get("appealEvidence")));
        appeal.setAppellantType("merchant");
        appeal.setAppellantId(evaluation.getEvaluateeId());
        appeal.setAppellantName(appellantName);
        appeal.setAppealStatus("pending");
        appeal.setDelFlag(0);
        appeal.setCreateTime(new Date());
        appeal.setUpdateTime(new Date());
        int result = appealMapper.insert(appeal);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("申诉失败");
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    /*
     * 申诉审核接口已移除。
     *
     * 原先是 POST /api/trade/evaluation/appeal/{id}/audit —— 它没有任何运营角色校验
     * （路径不在 /api/trade/admin 下，认证拦截器那道运营角色判断覆盖不到），
     * 也就是说**任何登录用户都能审核申诉，而审核通过会把别人的评价置为隐藏**。
     * 那个能力已经搬到运营端：POST /api/trade/admin/credit/appeal/{id}/audit，
     * 由 AdminCreditController + CreditService 承担，自动受角色校验保护。
     * 前端此前没有任何地方调用旧路径（已核实），所以直接删除而不是保留兼容。
     */
}
