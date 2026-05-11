package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.EvaluationAppeal;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.EvaluationAppealMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;

@RestController
@RequestMapping("/api/trade/evaluation")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationMapper evaluationMapper;
    private final EvaluationAppealMapper appealMapper;

    @GetMapping("/page")
    public ApiResponse<IPage<Evaluation>> getEvaluationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) Long evaluateeId) {
        Page<Evaluation> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        if (orderId != null) wrapper.eq(Evaluation::getOrderId, orderId);
        if (evaluateeId != null) wrapper.eq(Evaluation::getEvaluateeId, evaluateeId);
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

    @PostMapping("/appeal")
    public ApiResponse<Boolean> appealEvaluation(@RequestBody EvaluationAppeal appeal) {
        appeal.setAppealNo("AP" + System.currentTimeMillis());
        appeal.setAppealStatus("pending");
        appeal.setCreateTime(new Date());
        appeal.setUpdateTime(new Date());
        int result = appealMapper.insert(appeal);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("申诉失败");
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