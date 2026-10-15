package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.FoodSafetyInputCompliance;
import com.agri.production.entity.FoodSafetyLabelCompliance;
import com.agri.production.entity.FoodSafetyStandardItem;
import com.agri.production.entity.FoodSafetyStandardLibrary;
import com.agri.production.entity.FoodSafetyStandardSummary;
import com.agri.production.mapper.FoodSafetyInputComplianceMapper;
import com.agri.production.mapper.FoodSafetyLabelComplianceMapper;
import com.agri.production.mapper.FoodSafetyStandardItemMapper;
import com.agri.production.mapper.FoodSafetyStandardLibraryMapper;
import com.agri.production.mapper.FoodSafetyStandardSummaryMapper;
import com.agri.production.service.IAdminFoodSafetyComplianceService;
import com.agri.production.vo.AdminFsInputComplianceVO;
import com.agri.production.vo.AdminFsLabelComplianceVO;
import com.agri.production.vo.AdminFsStandardItemVO;
import com.agri.production.vo.AdminFsStandardOptionVO;
import com.agri.production.vo.AdminFsStandardSummaryVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端：食品安全-合规校验管理实现（P17 三个 Tab）。
 *
 * <p>口径与平台侧 AdminFoodSafetyComplianceService 对齐，落到本服务的表。
 * 「执行自动校验」是真实重算：明细只读、汇总原地更新。</p>
 */
@Slf4j
@Service
public class AdminFoodSafetyComplianceServiceImpl implements IAdminFoodSafetyComplianceService {

    private static final String FILTER_ALL = "all";
    private static final String RESULT_OVER = "over";
    private static final String RESULT_FAIL = "fail";
    private static final String RECTIFY_NOTIFIED = "notified";
    private static final int REMARK_MAX_LENGTH = 200;
    private static final int DEADLINE_MAX_LENGTH = 100;
    /** 运营端数据属于演示租户（一主体一租户；运营端不按租户过滤，见接口注释） */
    private static final String DEFAULT_TENANT = "2001";
    private static final Map<String, Integer> SCOPE_DAYS = Map.of(
            "last7d", 7,
            "last30d", 30,
            "quarter", 90);

    private final FoodSafetyInputComplianceMapper inputMapper;
    private final FoodSafetyLabelComplianceMapper labelMapper;
    private final FoodSafetyStandardLibraryMapper standardLibraryMapper;
    private final FoodSafetyStandardItemMapper standardItemMapper;
    private final FoodSafetyStandardSummaryMapper standardSummaryMapper;

    public AdminFoodSafetyComplianceServiceImpl(FoodSafetyInputComplianceMapper inputMapper,
                                               FoodSafetyLabelComplianceMapper labelMapper,
                                               FoodSafetyStandardLibraryMapper standardLibraryMapper,
                                               FoodSafetyStandardItemMapper standardItemMapper,
                                               FoodSafetyStandardSummaryMapper standardSummaryMapper) {
        this.inputMapper = inputMapper;
        this.labelMapper = labelMapper;
        this.standardLibraryMapper = standardLibraryMapper;
        this.standardItemMapper = standardItemMapper;
        this.standardSummaryMapper = standardSummaryMapper;
    }

    /* ==================== Tab1 投入品合规 ==================== */

    @Override
    public PageResult<AdminFsInputComplianceVO> pageInputs(int pageNum, int pageSize, String result, String farmName,
                                                          String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FoodSafetyInputCompliance> w = new LambdaQueryWrapper<>();
        if (isEffective(result)) {
            w.eq(FoodSafetyInputCompliance::getCheckResult, result.trim().toLowerCase());
        }
        if (isEffective(farmName)) {
            w.like(FoodSafetyInputCompliance::getFarmName, farmName.trim());
        }
        if (isEffective(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(FoodSafetyInputCompliance::getInputName, kw)
                    .or().like(FoodSafetyInputCompliance::getRecordId, kw));
        }
        // 同一天的多条按编号倒序，保证分页稳定（只按日期排的话同一天内顺序由引擎决定，翻页会串）
        w.orderByDesc(FoodSafetyInputCompliance::getCheckDate)
                .orderByDesc(FoodSafetyInputCompliance::getRecordId);
        Page<FoodSafetyInputCompliance> page = inputMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsInputComplianceVO> rows = page.getRecords().stream()
                .map(AdminFsInputComplianceVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsInputComplianceVO punishInput(String recordId, String action, BigDecimal amount, String remark) {
        if (!isEffective(action)) {
            throw new BusinessException(400, "处罚方式为必填");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "处罚金额须大于 0");
        }
        if (!isEffective(remark)) {
            throw new BusinessException(400, "整改要求为必填");
        }
        if (remark.trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(400, "整改要求不得超过 " + REMARK_MAX_LENGTH + " 字");
        }
        FoodSafetyInputCompliance record = requireInput(recordId);
        if (!RESULT_OVER.equals(record.getCheckResult())) {
            throw new BusinessException(400, "仅超标记录可登记处罚：" + recordId);
        }
        record.setPunishAction(action.trim());
        record.setPunishAmount(amount);
        record.setPunishRemark(remark.trim());
        record.setPunishTime(LocalDateTime.now());
        // 处罚痕迹 append 进 violation：监管抽查要能在一行里看到"违规事实 + 已怎么处理"，
        // 分两张表存的话举证时得跨表拼，而且这里本来也没有第二张表。
        String base = record.getViolation() == null || record.getViolation().isBlank()
                ? "" : record.getViolation() + "；";
        record.setViolation(base + "【已处罚：" + action.trim() + "，罚款 "
                + amount.stripTrailingZeros().toPlainString() + " 元】");
        inputMapper.updateById(record);
        log.info("投入品合规处罚登记：{} → {}（{} 元）", record.getRecordId(), action.trim(), amount);
        return AdminFsInputComplianceVO.of(inputMapper.selectById(record.getRecordId()));
    }

    /* ==================== Tab2 产品标签合规 ==================== */

    @Override
    public PageResult<AdminFsLabelComplianceVO> pageLabels(int pageNum, int pageSize, String result, String productName,
                                                          String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FoodSafetyLabelCompliance> w = new LambdaQueryWrapper<>();
        if (isEffective(result)) {
            w.eq(FoodSafetyLabelCompliance::getCheckResult, result.trim().toLowerCase());
        }
        if (isEffective(productName)) {
            w.like(FoodSafetyLabelCompliance::getProductName, productName.trim());
        }
        if (isEffective(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(FoodSafetyLabelCompliance::getProducer, kw)
                    .or().like(FoodSafetyLabelCompliance::getLabelId, kw));
        }
        w.orderByDesc(FoodSafetyLabelCompliance::getCheckedAt)
                .orderByDesc(FoodSafetyLabelCompliance::getLabelId);
        Page<FoodSafetyLabelCompliance> page = labelMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsLabelComplianceVO> rows = page.getRecords().stream()
                .map(AdminFsLabelComplianceVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsLabelComplianceVO rectifyLabel(String labelId, String deadline, String remark) {
        if (!isEffective(deadline)) {
            throw new BusinessException(400, "整改期限为必填");
        }
        if (deadline.trim().length() > DEADLINE_MAX_LENGTH) {
            throw new BusinessException(400, "整改期限不得超过 " + DEADLINE_MAX_LENGTH + " 字");
        }
        if (!isEffective(remark)) {
            throw new BusinessException(400, "整改要求为必填");
        }
        if (remark.trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(400, "整改要求不得超过 " + REMARK_MAX_LENGTH + " 字");
        }
        FoodSafetyLabelCompliance label = requireLabel(labelId);
        label.setRectifyStatus(RECTIFY_NOTIFIED);
        label.setRectifyDeadline(deadline.trim());
        label.setRectifyRemark(remark.trim());
        label.setRectifyTime(LocalDateTime.now());
        labelMapper.updateById(label);
        log.info("标签整改通知下发：{} → 期限 {}", label.getLabelId(), deadline.trim());
        return AdminFsLabelComplianceVO.of(labelMapper.selectById(label.getLabelId()));
    }

    /* ==================== Tab3 行业标准校验 ==================== */

    @Override
    public List<AdminFsStandardOptionVO> listStandards() {
        List<FoodSafetyStandardLibrary> standards = standardLibraryMapper.selectList(
                new LambdaQueryWrapper<FoodSafetyStandardLibrary>()
                        .eq(FoodSafetyStandardLibrary::getStatus, 1)
                        .orderByAsc(FoodSafetyStandardLibrary::getSortNo));
        return standards.stream().map(AdminFsStandardOptionVO::of).toList();
    }

    @Override
    public List<AdminFsStandardItemVO> listStandardItems(String standardNo) {
        requireStandard(standardNo);
        List<FoodSafetyStandardItem> items = standardItemMapper.selectList(
                new LambdaQueryWrapper<FoodSafetyStandardItem>()
                        .eq(FoodSafetyStandardItem::getStandardNo, standardNo.trim())
                        .orderByDesc(FoodSafetyStandardItem::getCheckTime));
        return items.stream().map(AdminFsStandardItemVO::of).toList();
    }

    @Override
    public AdminFsStandardSummaryVO standardSummary(String standardNo) {
        requireStandard(standardNo);
        FoodSafetyStandardSummary summary = standardSummaryMapper.selectOne(
                new LambdaQueryWrapper<FoodSafetyStandardSummary>()
                        .eq(FoodSafetyStandardSummary::getStandardNo, standardNo.trim()));
        if (summary == null) {
            // 不回一组 0：0% 是"校验跑了、结果全不合格"的语义，和"根本没校验过"是两件事
            throw new BusinessException(404, "该标准尚无校验汇总，请先执行自动校验：" + standardNo.trim());
        }
        return AdminFsStandardSummaryVO.of(summary);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsStandardSummaryVO runStandard(String standardNo, String bodyStandardNo, String batchScope) {
        if (!isEffective(standardNo)) {
            throw new BusinessException(400, "标准编号为必填");
        }
        String no = standardNo.trim();
        if (!isEffective(batchScope)) {
            throw new BusinessException(400, "批次范围为必填");
        }
        String scope = batchScope.trim();
        Integer days = SCOPE_DAYS.get(scope);
        if (days == null) {
            throw new BusinessException(400, "批次范围应为 last7d / last30d / quarter：" + scope);
        }
        if (isEffective(bodyStandardNo) && !no.equals(bodyStandardNo.trim())) {
            throw new BusinessException(400, "请求体标准编号与路径参数不一致");
        }
        requireStandard(no);

        LocalDateTime from = LocalDateTime.now().minusDays(days);
        List<FoodSafetyStandardItem> items = standardItemMapper.selectList(
                new LambdaQueryWrapper<FoodSafetyStandardItem>()
                        .eq(FoodSafetyStandardItem::getStandardNo, no)
                        .ge(FoodSafetyStandardItem::getCheckTime, from));

        // 批次判定：同批次下**所有**项都非 fail 才通过 —— 一项不合格整批不合格。
        // 用 LinkedHashMap：批次顺序即首次出现顺序，便于人工对着日志核对。
        Map<String, Boolean> batchPass = new LinkedHashMap<>();
        for (FoodSafetyStandardItem item : items) {
            String batchNo = item.getBatchNo() == null || item.getBatchNo().isBlank()
                    ? "(未关联批次)" : item.getBatchNo();
            boolean pass = !RESULT_FAIL.equals(item.getCheckResult());
            batchPass.merge(batchNo, pass, (left, right) -> left && right);
        }
        int batchCount = batchPass.size();
        long passCount = batchPass.values().stream().filter(Boolean::booleanValue).count();
        int failCount = batchCount - (int) passCount;
        BigDecimal passRate = batchCount == 0 ? null
                : BigDecimal.valueOf(passCount * 100)
                        .divide(BigDecimal.valueOf(batchCount), 1, RoundingMode.HALF_UP);

        FoodSafetyStandardSummary summary = standardSummaryMapper.selectOne(
                new LambdaQueryWrapper<FoodSafetyStandardSummary>()
                        .eq(FoodSafetyStandardSummary::getStandardNo, no));
        boolean isNew = summary == null;
        if (isNew) {
            summary = new FoodSafetyStandardSummary();
            summary.setSummaryId("FS-SUM-" + no + "-" + System.currentTimeMillis());
            summary.setStandardNo(no);
            summary.setTenantId(DEFAULT_TENANT);
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
        log.info("标准自动校验执行：{}（窗口 {} 天）→ {} 批 / 通过 {} / 不通过 {} / 明细 {} 项",
                no, days, batchCount, passCount, failCount, items.size());
        return AdminFsStandardSummaryVO.of(summary);
    }

    /* ==================== 内部工具 ==================== */

    /** 标准必须存在，否则 404 —— 避免"查一个不存在的标准返回空列表"这种看不出错的结果。 */
    private void requireStandard(String standardNo) {
        if (!isEffective(standardNo)) {
            throw new BusinessException(400, "标准编号为必填");
        }
        if (standardLibraryMapper.selectById(standardNo.trim()) == null) {
            throw new BusinessException(404, "行业标准不存在：" + standardNo.trim());
        }
    }

    private FoodSafetyInputCompliance requireInput(String recordId) {
        if (!isEffective(recordId)) {
            throw new BusinessException(400, "缺少记录编号");
        }
        FoodSafetyInputCompliance record = inputMapper.selectById(recordId.trim());
        if (record == null) {
            throw new BusinessException(404, "投入品合规记录不存在：" + recordId.trim());
        }
        return record;
    }

    private FoodSafetyLabelCompliance requireLabel(String labelId) {
        if (!isEffective(labelId)) {
            throw new BusinessException(400, "缺少标签编号");
        }
        FoodSafetyLabelCompliance label = labelMapper.selectById(labelId.trim());
        if (label == null) {
            throw new BusinessException(404, "标签合规记录不存在：" + labelId.trim());
        }
        return label;
    }

    /** 值是否有效（非空且不等于 all）。 */
    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
