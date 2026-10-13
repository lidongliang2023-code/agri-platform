package com.agri.trade.service;

import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.EvaluationAppeal;
import com.agri.trade.mapper.EvaluationAppealMapper;
import com.agri.trade.mapper.EvaluationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 信用管理（运营端）。
 *
 * <p>这一页基本是"接线"：评价表与申诉表早就有数据，申诉审核的逻辑也早就写在
 * EvaluationController 里，但一直**没有任何入口** —— 运营看不到申诉，也就无从处理。</p>
 *
 * <p>顺带收掉一处越权：原来的审核接口是 {@code POST /api/trade/evaluation/appeal/{id}/audit}，
 * 既没有运营角色校验（路径不在 /api/trade/admin 下），也没有别的判定 ——
 * 任何登录用户都能审核申诉，而**审核通过会把别人的评价置为隐藏**。
 * 那个接口已删除，改为本模块下的运营端路径。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CreditService {

    /** 评价状态词表。 */
    private static final Set<String> EVALUATION_STATUSES = Set.of("published", "hidden");

    private final EvaluationMapper evaluationMapper;
    private final EvaluationAppealMapper appealMapper;

    /** 评价列表（运营看全平台）。 */
    public IPage<Evaluation> evaluationPage(int pageNum, int pageSize, String evaluationNo,
                                            BigDecimal ratingOverall, String evaluationStatus) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        if (evaluationNo != null && !evaluationNo.isEmpty()) {
            wrapper.like(Evaluation::getEvaluationNo, evaluationNo);
        }
        if (ratingOverall != null) {
            wrapper.eq(Evaluation::getRatingOverall, ratingOverall);
        }
        if (evaluationStatus != null && !evaluationStatus.isEmpty()) {
            wrapper.eq(Evaluation::getEvaluationStatus, evaluationStatus);
        }
        wrapper.orderByDesc(Evaluation::getCreateTime);
        return evaluationMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    /**
     * 隐藏 / 恢复一条评价（运营的违规处置）。
     *
     * @param action hide 隐藏 / restore 恢复
     * @return 失败原因；成功时返回 null
     */
    @Transactional
    public String changeEvaluationStatus(Long id, String action, String reason) {
        Evaluation evaluation = evaluationMapper.selectById(id);
        if (evaluation == null) {
            return "评价不存在";
        }
        if (!"hide".equals(action) && !"restore".equals(action)) {
            return "动作只支持 hide（隐藏）或 restore（恢复）";
        }
        // 隐藏必须给理由：这条评价是公开的，隐藏它要有据可查，否则就是"凭空让一条差评消失"。
        if ("hide".equals(action) && (reason == null || reason.isEmpty())) {
            return "隐藏评价必须填写原因";
        }
        if ("hide".equals(action)) {
            evaluation.setEvaluationStatus("hidden");
            evaluation.setHideReason(reason);
        } else {
            evaluation.setEvaluationStatus("published");
            evaluation.setHideReason(null);
        }
        evaluation.setUpdateTime(new Date());
        evaluationMapper.updateById(evaluation);
        log.info("评价状态变更：evaluationId={} action={} reason={}", id, action, reason);
        return null;
    }

    /**
     * 申诉列表（附上关联评价的信息）。
     *
     * <p>申诉表里只有 evaluationId，运营要判断得看到"被申诉的是哪条评价、打给谁、几分" ——
     * 不然列表上只有一串编号，根本没法处理。</p>
     */
    public IPage<Map<String, Object>> appealPage(int pageNum, int pageSize, String appealStatus) {
        LambdaQueryWrapper<EvaluationAppeal> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(EvaluationAppeal::getDelFlag, 0);
        if (appealStatus != null && !appealStatus.isEmpty()) {
            wrapper.eq(EvaluationAppeal::getAppealStatus, appealStatus);
        }
        wrapper.orderByDesc(EvaluationAppeal::getCreateTime);
        Page<EvaluationAppeal> page = appealMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);

        Set<Long> evaluationIds = page.getRecords().stream()
                .map(EvaluationAppeal::getEvaluationId).filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Evaluation> evaluations = evaluationIds.isEmpty() ? Map.of()
                : evaluationMapper.selectBatchIds(evaluationIds).stream()
                        .collect(Collectors.toMap(Evaluation::getId, e -> e));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (EvaluationAppeal appeal : page.getRecords()) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("id", appeal.getId());
            view.put("appealNo", appeal.getAppealNo());
            view.put("evaluationId", appeal.getEvaluationId());
            view.put("appealType", appeal.getAppealType());
            view.put("appealReason", appeal.getAppealReason());
            view.put("appealEvidence", appeal.getAppealEvidence());
            view.put("appellantId", appeal.getAppellantId());
            view.put("appellantName", appeal.getAppellantName());
            view.put("appealStatus", appeal.getAppealStatus());
            view.put("reviewer", appeal.getReviewer());
            view.put("reviewTime", appeal.getReviewTime());
            view.put("reviewResult", appeal.getReviewResult());
            view.put("reviewRemark", appeal.getReviewRemark());
            view.put("createTime", appeal.getCreateTime());

            Evaluation evaluation = appeal.getEvaluationId() == null ? null : evaluations.get(appeal.getEvaluationId());
            if (evaluation != null) {
                view.put("evaluationNo", evaluation.getEvaluationNo());
                view.put("orderId", evaluation.getOrderId());
                view.put("evaluatorName", evaluation.getEvaluatorName());
                view.put("evaluateeName", evaluation.getEvaluateeName());
                view.put("ratingOverall", evaluation.getRatingOverall());
                view.put("evaluationStatus", evaluation.getEvaluationStatus());
                view.put("evaluationContent", evaluation.getEvaluationContent());
            }
            rows.add(view);
        }

        Page<Map<String, Object>> result = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        result.setRecords(rows);
        return result;
    }

    /**
     * 审核申诉。
     *
     * @param status approved 通过（同时隐藏被申诉的评价） / rejected 驳回
     * @return 失败原因；成功时返回 null
     */
    @Transactional
    public String auditAppeal(Long id, String status, String remark, String reviewer) {
        EvaluationAppeal appeal = appealMapper.selectById(id);
        if (appeal == null) {
            return "申诉不存在";
        }
        if (!"approved".equals(status) && !"rejected".equals(status)) {
            return "审核结论只支持 approved（通过）或 rejected（驳回）";
        }
        if (!"pending".equals(appeal.getAppealStatus())) {
            return "这条申诉已经处理过了";
        }

        appeal.setAppealStatus(status);
        appeal.setReviewer(reviewer);
        appeal.setReviewTime(new Date());
        appeal.setReviewResult(status);
        appeal.setReviewRemark(remark);
        appeal.setUpdateTime(new Date());
        appealMapper.updateById(appeal);

        if ("approved".equals(status)) {
            Evaluation evaluation = evaluationMapper.selectById(appeal.getEvaluationId());
            if (evaluation != null) {
                evaluation.setEvaluationStatus("hidden");
                evaluation.setHideReason("申诉通过" + (remark == null || remark.isEmpty() ? "" : "：" + remark));
                evaluation.setUpdateTime(new Date());
                evaluationMapper.updateById(evaluation);
            }
        }
        log.info("申诉审核：appealId={} status={} reviewer={}", id, status, reviewer);
        return null;
    }

    static boolean isKnownEvaluationStatus(String status) {
        return status != null && EVALUATION_STATUSES.contains(status);
    }
}
