package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.EvaluationAppeal;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.EvaluationAppealMapper;
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
        evaluation.setEvaluationNo("EV" + System.currentTimeMillis());
        evaluation.setDelFlag(0);
        evaluation.setEvaluationStatus("show");
        evaluation.setCreateTime(new Date());
        evaluation.setUpdateTime(new Date());
        int result = evaluationMapper.insert(evaluation);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}/reply")
    public ApiResponse<Boolean> replyEvaluation(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        Evaluation evaluation = evaluationMapper.selectById(id);
        if (evaluation == null) return ApiResponse.error("评价不存在");
        evaluation.setReplyContent(params.get("content"));
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

    @PostMapping("/appeal/{id}/audit")
    public ApiResponse<Boolean> auditAppeal(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        EvaluationAppeal appeal = appealMapper.selectById(id);
        if (appeal == null) return ApiResponse.error("申诉不存在");

        appeal.setAppealStatus(params.get("status"));
        appeal.setReviewer(params.get("reviewer"));
        appeal.setReviewTime(new Date());
        appeal.setReviewResult(params.get("result"));
        appeal.setReviewRemark(params.get("remark"));
        appeal.setUpdateTime(new Date());

        int result = appealMapper.updateById(appeal);
        if (result > 0 && "approved".equals(params.get("status"))) {
            Evaluation evaluation = evaluationMapper.selectById(appeal.getEvaluationId());
            if (evaluation != null) {
                evaluation.setEvaluationStatus("hidden");
                evaluation.setHideReason("申诉通过");
                evaluationMapper.updateById(evaluation);
            }
        }
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }
}
