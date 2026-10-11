package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 运营端：合规校验管理（P17 三个 Tab）。
 *
 * <p>Tab1 投入品合规台账、Tab2 产品标签合规、Tab3 行业标准校验。
 * Tab3 的「执行自动校验」是**真实重算**：以 {@code prod_fs_standard_item} 明细为唯一输入，
 * 按所选时间窗重算该标准的批次级指标并落库。</p>
 *
 * <p><b>口径说明（重要）</b>：种子里的 {@code prod_fs_standard_summary} 是<strong>全量历史基线</strong>
 * （5 标准合计 1240 批），而明细表只有 5 个演示批次。因此执行自动校验后，数字会明显小于
 * 种子基线——这是真实重算的结果，不是缺陷；要让两者同量级，需要补明细种子，属数据问题。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFoodSafetyComplianceService {

    private static final String FILTER_ALL = "all";
    private static final String RESULT_OVER = "over";
    private static final String RESULT_PASS = "pass";
    private static final String RESULT_FAIL = "fail";
    private static final String RECTIFY_NOTIFIED = "notified";
    private static final int REMARK_MAX_LENGTH = 200;
    private static final int DEADLINE_MAX_LENGTH = 100;
    private static final Map<String, Integer> SCOPE_DAYS = Map.of(
            "last7d", 7,
            "last30d", 30,
            "quarter", 90);

    private final InputComplianceMapper inputComplianceMapper;
    private final LabelComplianceMapper labelComplianceMapper;
    private final StandardLibraryMapper standardLibraryMapper;
    private final StandardItemMapper standardItemMapper;
    private final StandardSummaryMapper standardSummaryMapper;

    /* ==================== Tab1 投入品合规 ==================== */

    /**
     * 投入品合规台账分页。
     *
     * @param page     页码
     * @param size     每页条数（页面统计会以 pageSize=1000 全量拉取）
     * @param result   校验结果筛选（all/空 = 不筛选）
     * @param farmName 农场名称模糊匹配
     * @param keyword  关键字：模糊匹配投入品名称 / 记录编号
     * @return 分页结果
     */
    public PageResult<InputComplianceEntity> pageInputs(long page, long size, String result,
                                                        String farmName, String keyword) {
        Page<InputComplianceEntity> resultPage = inputComplianceMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InputComplianceEntity>()
                        .eq(isEffective(result), InputComplianceEntity::getResult, result)
                        .like(isEffective(farmName), InputComplianceEntity::getFarmName, farmName)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(InputComplianceEntity::getInputName, keyword)
                                .or().like(InputComplianceEntity::getId, keyword))
                        .orderByDesc(InputComplianceEntity::getCheckDate));
        return PageResult.of(resultPage.getRecords(), resultPage.getTotal(), page, size);
    }

    /**
     * 超标处罚登记（写操作）。
     *
     * <p>只允许对 {@code over} 记录登记处罚：合规记录没有可处罚的事实基础。
     * 该守卫与页面一致（页面处罚按钮仅在 {@code result === 'over'} 时渲染）。
     * 处罚标记追加写入 {@code violation} 列，形成可审计的处理痕迹。</p>
     *
     * @param id      记录编号
     * @param request 处罚请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean punish(String id, InputPunishRequest request) {
        if (request == null || !isEffective(request.action())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处罚方式为必填");
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处罚金额须大于 0");
        }
        if (!isEffective(request.remark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改要求为必填");
        }
        if (request.remark().trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改要求不得超过 200 字");
        }
        InputComplianceEntity record = inputComplianceMapper.selectById(id);
        if (record == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "投入品合规记录不存在：" + id);
        }
        if (!RESULT_OVER.equals(record.getResult())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅超标记录可登记处罚：" + id);
        }
        record.setPunishAction(request.action().trim());
        record.setPunishAmount(request.amount());
        record.setPunishRemark(request.remark().trim());
        record.setPunishTime(LocalDateTime.now());
        String base = record.getViolationDesc() == null ? "" : record.getViolationDesc() + "；";
        record.setViolationDesc(base + "【已处罚：" + request.action().trim()
                + "，罚款 " + request.amount().stripTrailingZeros().toPlainString() + " 元】");
        return inputComplianceMapper.updateById(record) > 0;
    }

    /* ==================== Tab2 产品标签合规 ==================== */

    /**
     * 产品标签合规分页。
     *
     * @param page        页码
     * @param size        每页条数（统计需全量拉取）
     * @param result      校验结果筛选（all/空 = 不筛选）
     * @param productName 产品名称模糊匹配
     * @param keyword     关键字：模糊匹配生产者 / 标签编号
     * @return 分页结果
     */
    public PageResult<LabelComplianceEntity> pageLabels(long page, long size, String result,
                                                        String productName, String keyword) {
        Page<LabelComplianceEntity> resultPage = labelComplianceMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<LabelComplianceEntity>()
                        .eq(isEffective(result), LabelComplianceEntity::getResult, result)
                        .like(isEffective(productName), LabelComplianceEntity::getProductName, productName)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(LabelComplianceEntity::getProducer, keyword)
                                .or().like(LabelComplianceEntity::getId, keyword))
                        .orderByDesc(LabelComplianceEntity::getCheckTime));
        return PageResult.of(resultPage.getRecords(), resultPage.getTotal(), page, size);
    }

    /**
     * 下发标签整改通知（写操作）。
     *
     * @param id      标签编号
     * @param request 整改请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean rectify(String id, LabelRectifyRequest request) {
        if (request == null || !isEffective(request.deadline())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改期限为必填");
        }
        if (request.deadline().trim().length() > DEADLINE_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改期限不得超过 100 字");
        }
        if (!isEffective(request.remark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改要求为必填");
        }
        if (request.remark().trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "整改要求不得超过 200 字");
        }
        LabelComplianceEntity label = labelComplianceMapper.selectById(id);
        if (label == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "标签合规记录不存在：" + id);
        }
        label.setRectifyStatus(RECTIFY_NOTIFIED);
        label.setRectifyDeadline(request.deadline().trim());
        label.setRectifyRemark(request.remark().trim());
        label.setRectifyTime(LocalDateTime.now());
        return labelComplianceMapper.updateById(label) > 0;
    }

    /* ==================== Tab3 行业标准校验 ==================== */

    /**
     * 行业标准库下拉（仅启用项，按排序号）。
     *
     * @return 标准列表
     */
    public List<StandardLibraryEntity> listStandards() {
        return standardLibraryMapper.selectList(new LambdaQueryWrapper<StandardLibraryEntity>()
                .eq(StandardLibraryEntity::getStatus, 1)
                .orderByAsc(StandardLibraryEntity::getSortNo));
    }

    /**
     * 指定标准的校验项明细。
     *
     * @param standardNo 标准编号
     * @return 校验项列表（按抽检时间倒序）
     */
    public List<StandardItemEntity> listStandardItems(String standardNo) {
        requireStandard(standardNo);
        return standardItemMapper.selectList(new LambdaQueryWrapper<StandardItemEntity>()
                .eq(StandardItemEntity::getStandardNo, standardNo)
                .orderByDesc(StandardItemEntity::getCheckTime));
    }

    /**
     * 指定标准的校验汇总。
     *
     * <p>尚未执行过校验的标准返回 404 并给出可操作提示，而不是回一组 0——
     * 0 是「真实为零」的语义，与「没有数据」不是一回事。</p>
     *
     * @param standardNo 标准编号
     * @return 汇总
     */
    public StandardSummaryEntity standardSummary(String standardNo) {
        requireStandard(standardNo);
        StandardSummaryEntity summary = standardSummaryMapper.selectOne(
                new LambdaQueryWrapper<StandardSummaryEntity>()
                        .eq(StandardSummaryEntity::getStandardNo, standardNo));
        if (summary == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND,
                    "该标准尚无校验汇总，请先执行自动校验：" + standardNo);
        }
        return summary;
    }

    /**
     * 执行行业标准自动校验（写操作，真实重算）。
     *
     * <p>以抽检明细为唯一输入，按所选窗口重算批次级指标：同一批次下所有校验项均 pass
     * 才算该批次通过。明细本身不会被改写（它是重算的输入，不是结果）。</p>
     *
     * @param pathStandardNo 路径参数中的标准编号
     * @param request        请求体（含标准编号与批次范围）
     * @return 重算后的汇总
     */
    @Transactional
    public StandardSummaryEntity runStandard(String pathStandardNo, StandardRunRequest request) {
        if (!isEffective(pathStandardNo)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "标准编号为必填");
        }
        if (request == null || !isEffective(request.batchScope())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "批次范围为必填");
        }
        String scope = request.batchScope().trim();
        Integer days = SCOPE_DAYS.get(scope);
        if (days == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "批次范围应为 last7d / last30d / quarter：" + scope);
        }
        if (isEffective(request.standardNo()) && !pathStandardNo.equals(request.standardNo().trim())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体标准编号与路径参数不一致");
        }
        requireStandard(pathStandardNo);

        LocalDateTime from = LocalDateTime.now().minusDays(days);
        List<StandardItemEntity> items = standardItemMapper.selectList(
                new LambdaQueryWrapper<StandardItemEntity>()
                        .eq(StandardItemEntity::getStandardNo, pathStandardNo)
                        .ge(StandardItemEntity::getCheckTime, from));

        Map<String, Boolean> batchPass = new LinkedHashMap<>();
        for (StandardItemEntity item : items) {
            String batchNo = item.getBatchNo() == null || item.getBatchNo().isBlank()
                    ? "(未关联批次)" : item.getBatchNo();
            boolean pass = !RESULT_FAIL.equals(item.getResult());
            batchPass.merge(batchNo, pass, (left, right) -> left && right);
        }
        int batchCount = batchPass.size();
        long passCount = batchPass.values().stream().filter(Boolean::booleanValue).count();
        int failCount = batchCount - (int) passCount;
        BigDecimal passRate = batchCount == 0 ? null
                : BigDecimal.valueOf(passCount * 100)
                        .divide(BigDecimal.valueOf(batchCount), 1, RoundingMode.HALF_UP);

        StandardSummaryEntity summary = standardSummaryMapper.selectOne(
                new LambdaQueryWrapper<StandardSummaryEntity>()
                        .eq(StandardSummaryEntity::getStandardNo, pathStandardNo));
        boolean isNew = summary == null;
        if (isNew) {
            summary = new StandardSummaryEntity();
            summary.setSummaryId("FS-SUM-" + pathStandardNo + "-" + System.currentTimeMillis());
            summary.setStandardNo(pathStandardNo);
        }
        summary.setBatchCount(batchCount);
        summary.setPassCount((int) passCount);
        summary.setFailCount(failCount);
        summary.setPassRate(passRate);
        summary.setLastRunTime(LocalDateTime.now());
        if (isNew) {
            standardSummaryMapper.insert(summary);
        } else {
            standardSummaryMapper.updateById(summary);
        }
        return summary;
    }

    /* ==================== 内部工具 ==================== */

    /** 标准必须存在，否则 404——避免「查不存在的标准返回空列表」这种看不出错的结果。 */
    private void requireStandard(String standardNo) {
        if (!isEffective(standardNo)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "标准编号为必填");
        }
        if (standardLibraryMapper.selectById(standardNo) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "行业标准不存在：" + standardNo);
        }
    }

    /** 值是否有效（非空且不等于 all）。 */
    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
