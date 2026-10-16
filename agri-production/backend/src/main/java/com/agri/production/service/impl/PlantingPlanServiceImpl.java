package com.agri.production.service.impl;

import com.agri.production.common.constant.PlanStatusDict;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.PlantingPlanSaveDTO;
import com.agri.production.entity.Farm;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.entity.Plot;
import com.agri.production.entity.TeamMember;
import com.agri.production.entity.CropInfo;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.mapper.CropInfoMapper;
import com.agri.production.service.IPlantingPlanService;
import com.agri.production.vo.PlantingPlanVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
@Slf4j
public class PlantingPlanServiceImpl extends ServiceImpl<PlantingPlanMapper, PlantingPlan>
        implements IPlantingPlanService {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter CODE_DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** 地块台账：只给地块 ID 时用来补齐地块名称、并校验该地块真实存在。 */
    private final PlotMapper plotMapper;
    /** 农场台账：同理补齐农场名称（计划详情页「所属农场」读的是 name 列）。 */
    private final FarmMapper farmMapper;
    /** 成员台账：把负责人落到 manager_id（成员主键）+ manager_name（真实姓名）。 */
    private final TeamMemberMapper memberMapper;
    /** 作物主数据：把作物落到 crop_id（主键）+ crop_name（名称）。 */
    private final CropInfoMapper cropMapper;

    public PlantingPlanServiceImpl(PlotMapper plotMapper, FarmMapper farmMapper, TeamMemberMapper memberMapper,
                                   CropInfoMapper cropMapper) {
        this.plotMapper = plotMapper;
        this.farmMapper = farmMapper;
        this.memberMapper = memberMapper;
        this.cropMapper = cropMapper;
    }

    @Override
    public IPage<PlantingPlan> queryPage(Page<PlantingPlan> page, Long farmId, String planName, Integer planYear, String planStatus) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0);

        if (farmId != null) {
            wrapper.eq(PlantingPlan::getFarmId, farmId);
        }
        if (planName != null && !planName.isEmpty()) {
            wrapper.like(PlantingPlan::getPlanName, planName);
        }
        if (planYear != null) {
            wrapper.eq(PlantingPlan::getPlanYear, planYear);
        }
        if (planStatus != null && !planStatus.isEmpty()) {
            wrapper.eq(PlantingPlan::getPlanStatus, planStatus);
        }

        wrapper.orderByDesc(PlantingPlan::getCreateTime);
        return this.page(page, wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByFarmId(Long farmId) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getFarmId, farmId)
               .orderByDesc(PlantingPlan::getPlanYear)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByYear(Integer planYear) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getPlanYear, planYear)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    @Override
    public List<PlantingPlan> getPlansByStatus(String planStatus) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlantingPlan::getDeleted, 0)
               .eq(PlantingPlan::getPlanStatus, planStatus)
               .orderByDesc(PlantingPlan::getCreateTime);
        return this.list(wrapper);
    }

    /**
     * 审批通过 → 进入「进行中」。
     *
     * <p>原先这里写的是 {@code plan_status = "approved"} —— 这个词表里根本没有，
     * 页面把未知值回落到「编制中」，于是"审批过的计划看起来像没审批"。
     * 现在统一走 {@link PlanStatusDict}，词表是封闭的。</p>
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean approvePlan(Long id, String approver, String comment) {
        PlantingPlan plan = this.getById(id);
        if (plan == null || Integer.valueOf(1).equals(plan.getDeleted())) {
            return false;
        }
        plan.setPlanStatus(PlanStatusDict.ACTIVE);
        plan.setApprover(approver);
        plan.setApprovalComment(comment);
        plan.setApprovalTime(new Date());
        plan.setUpdateTime(LocalDateTime.now());
        return this.updateById(plan);
    }

    /** 提交审批 → 待审批（原先写的 "submitted" 同样不在词表里）。 */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean submitPlan(Long id) {
        PlantingPlan plan = this.getById(id);
        if (plan == null || Integer.valueOf(1).equals(plan.getDeleted())) {
            return false;
        }
        plan.setPlanStatus(PlanStatusDict.PENDING);
        plan.setUpdateTime(LocalDateTime.now());
        return this.updateById(plan);
    }

    /* ==================== 前端契约方法 ==================== */

    @Override
    public PageResult<PlantingPlanVO> pageByContract(int pageNum, int pageSize, String keyword, String cropKeyword,
                                                    Integer status, String planStatus, Long farmId, Integer planYear,
                                                    String tenantId) {
        LambdaQueryWrapper<PlantingPlan> wrapper = new LambdaQueryWrapper<>();
        // 租户过滤**必须**在：这是用户端页面，漏掉这一条等于所有人看到全平台计划
        wrapper.eq(PlantingPlan::getTenantId, tenantId);

        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            // 前端搜索框走 keyword；计划编码是主键级信息，一起匹配 ——
            // 免得"编号记得住、名字记不住"时搜不到
            wrapper.and(q -> q.like(PlantingPlan::getPlanName, kw).or().like(PlantingPlan::getPlanCode, kw));
        }

        if (cropKeyword != null && !cropKeyword.isBlank()) {
            String ck = cropKeyword.trim();
            // 「作物」列既能填作物名（"水稻"）也能填作物 ID（数字）：
            // 名称走模糊匹配，纯数字再补一次 ID 精确匹配（ID 列是 BIGINT，不跟着模糊匹配，
            // 否则填 1 会连 12、123 一起命中）。
            if (ck.matches("\\d+")) {
                Long cropId = Long.valueOf(ck);
                wrapper.and(q -> q.like(PlantingPlan::getCropName, ck).or().eq(PlantingPlan::getCropId, cropId));
            } else {
                wrapper.like(PlantingPlan::getCropName, ck);
            }
        }

        List<String> words = resolveStatusFilter(status, planStatus);
        if (!words.isEmpty()) {
            wrapper.in(PlantingPlan::getPlanStatus, words);
        }
        if (farmId != null) {
            wrapper.eq(PlantingPlan::getFarmId, farmId);
        }
        if (planYear != null) {
            wrapper.eq(PlantingPlan::getPlanYear, planYear);
        }

        wrapper.orderByDesc(PlantingPlan::getCreateTime).orderByDesc(PlantingPlan::getId);

        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<PlantingPlan> result = this.page(new Page<>(safePage, safeSize), wrapper);
        List<PlantingPlanVO> list = result.getRecords().stream()
                .map(PlantingPlanVO::of)
                .collect(Collectors.toList());
        return PageResult.of(list, result.getTotal(), safePage, safeSize);
    }

    @Override
    public PlantingPlanVO detail(Long id, String tenantId) {
        return PlantingPlanVO.of(getOwned(id, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlantingPlan createByContract(PlantingPlanSaveDTO dto, String tenantId) {
        if (dto == null) {
            throw new BusinessException(400, "计划内容不能为空");
        }
        PlantingPlan plan = new PlantingPlan();
        plan.setTenantId(tenantId);
        applyDto(plan, dto, true, tenantId);
        if (isBlank(plan.getPlanName())) {
            throw new BusinessException(400, "计划名称不能为空");
        }
        if (isBlank(plan.getPlanCode())) {
            plan.setPlanCode(nextPlanCode(tenantId));
        }
        if (plan.getPlanStatus() == null) {
            plan.setPlanStatus(PlanStatusDict.DRAFT);
        }
        assertDateRange(plan);
        assertNoGrowingConflict(plan);
        plan.setCreateTime(LocalDateTime.now());
        plan.setUpdateTime(LocalDateTime.now());
        plan.setDeleted(0);
        try {
            this.save(plan);
        } catch (DuplicateKeyException e) {
            // plan_code 上有唯一索引，而索引不管逻辑删除 —— 软删过的同码计划仍会撞上
            throw new BusinessException(400, "计划编码已存在（含已删除的计划）：" + plan.getPlanCode());
        }
        return plan;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlantingPlan updateByContract(Long id, PlantingPlanSaveDTO dto, String tenantId) {
        PlantingPlan plan = getOwned(id, tenantId);
        if (dto == null) {
            throw new BusinessException(400, "计划内容不能为空");
        }
        // 在已加载的实体上就地改：编辑弹窗只下发其中一部分字段，
        // new 一个空实体再 updateById 会把没下发的列**清成 null**
        applyDto(plan, dto, false, tenantId);
        if (isBlank(plan.getPlanName())) {
            throw new BusinessException(400, "计划名称不能为空");
        }
        assertDateRange(plan);
        assertNoGrowingConflict(plan);
        plan.setUpdateTime(LocalDateTime.now());
        try {
            this.updateById(plan);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "计划编码已存在（含已删除的计划）：" + plan.getPlanCode());
        }
        return plan;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePlan(Long id, String tenantId) {
        getOwned(id, tenantId);
        this.removeById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlantingPlan startPlan(Long id, String tenantId) {
        PlantingPlan plan = getOwned(id, tenantId);
        Integer code = PlanStatusDict.toCode(plan.getPlanStatus());
        if (code == 2) {
            throw new BusinessException(400, "计划已经是「进行中」，无需再次启动");
        }
        if (code == 3 || code == 4) {
            throw new BusinessException(400, "「已完结」或「已取消」的计划不能重新启动");
        }
        plan.setPlanStatus(PlanStatusDict.ACTIVE);
        assertNoGrowingConflict(plan);
        plan.setUpdateTime(LocalDateTime.now());
        this.updateById(plan);
        return plan;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlantingPlan terminatePlan(Long id, String tenantId) {
        PlantingPlan plan = getOwned(id, tenantId);
        Integer code = PlanStatusDict.toCode(plan.getPlanStatus());
        if (code == 4) {
            throw new BusinessException(400, "计划已经是「已取消」");
        }
        if (code == 3) {
            throw new BusinessException(400, "「已完结」的计划不能再取消");
        }
        plan.setPlanStatus(PlanStatusDict.TERMINATED);
        plan.setUpdateTime(LocalDateTime.now());
        this.updateById(plan);
        return plan;
    }

    @Override
    public List<Map<String, Object>> calendar(String tenantId) {
        List<PlantingPlan> plans = this.list(new LambdaQueryWrapper<PlantingPlan>()
                .eq(PlantingPlan::getTenantId, tenantId)
                .orderByAsc(PlantingPlan::getStartDate));
        Map<String, Long> counts = new LinkedHashMap<>();
        Map<String, BigDecimal> areas = new LinkedHashMap<>();
        for (PlantingPlan plan : plans) {
            if (plan.getStartDate() == null) {
                // 没有开始日期的计划无法归月。**不猜**月份，跳过即可（因此各月之和可能小于计划总数）
                continue;
            }
            String month = toLocalDate(plan.getStartDate()).format(MONTH);
            counts.merge(month, 1L, Long::sum);
            areas.merge(month, plan.getTotalArea() == null ? BigDecimal.ZERO : plan.getTotalArea(), BigDecimal::add);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        counts.forEach((month, count) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", month);
            row.put("planCount", count);
            row.put("area", areas.getOrDefault(month, BigDecimal.ZERO));
            rows.add(row);
        });
        return rows;
    }

    /* ==================== 内部工具 ==================== */

    /**
     * 把入参落到实体上。
     *
     * @param create true = 新增（未下发的字段留空）；false = 编辑（未下发的字段保持原值）
     */
    private void applyDto(PlantingPlan plan, PlantingPlanSaveDTO dto, boolean create, String tenantId) {
        if (dto.getPlanCode() != null && !dto.getPlanCode().isBlank()) {
            plan.setPlanCode(dto.getPlanCode().trim());
        }
        if (dto.getPlanName() != null) {
            plan.setPlanName(dto.getPlanName().trim());
        }

        applyIdOrName(dto.getFarmId(), dto.getFarmName(), plan::setFarmId, plan::setFarmName, create);
        applyIdOrName(dto.getPlotId(), dto.getPlotName(), plan::setPlotId, plan::setPlotName, create);
        applyIdOrName(dto.getCropId(), dto.getCropName(), plan::setCropId, plan::setCropName, create);

        if (dto.getCropVariety() != null) {
            plan.setCropVariety(trimToNull(dto.getCropVariety()));
        }

        String start = dto.getPlanStartDate() != null ? dto.getPlanStartDate() : dto.getStartDate();
        if (start != null) {
            plan.setStartDate(parseDate(start));
        }
        String end = dto.getPlanEndDate() != null ? dto.getPlanEndDate() : dto.getEndDate();
        if (end != null) {
            plan.setEndDate(parseDate(end));
        }

        BigDecimal yield = dto.getExpectedYield() != null ? dto.getExpectedYield() : dto.getExpectedOutput();
        if (yield != null) {
            plan.setExpectedOutput(yield);
        }
        BigDecimal area = dto.getPlanArea() != null ? dto.getPlanArea() : dto.getTotalArea();
        if (area != null) {
            plan.setTotalArea(area);
        }
        if (dto.getTotalBudget() != null) {
            plan.setTotalBudget(dto.getTotalBudget());
        }
        if (dto.getExpectedProfit() != null) {
            plan.setExpectedProfit(dto.getExpectedProfit());
        }
        if (dto.getPlanYear() != null) {
            plan.setPlanYear(dto.getPlanYear());
        }
        if (dto.getPlanSeason() != null) {
            plan.setPlanSeason(trimToNull(dto.getPlanSeason()));
        }
        if (dto.getPlanSummary() != null) {
            plan.setPlanSummary(trimToNull(dto.getPlanSummary()));
        }

        String owner = dto.getOwnerId() != null ? dto.getOwnerId() : dto.getManagerId();
        applyIdOrName(owner, dto.getManagerName(), plan::setManagerId, plan::setManagerName, create);

        Long sopId = toLong(dto.getSopTemplateId());
        if (sopId != null) {
            plan.setSopTemplateId(sopId);
        }
        if (dto.getRemark() != null) {
            plan.setRemark(trimToNull(dto.getRemark()));
        }

        // ⚠️ 引用解析（农场名 / 地块名 / 负责人）必须放在**所有 applyIdOrName 之后**：
        // applyIdOrName 对"只给了 ID、没给 name"的字段会按新增语义把 name 清空，
        // 放在它前面解析好的名称会被这一句覆盖回 null
        // （写这版时实测到：负责人 manager_id=2 落库了，manager_name 却是空）。
        resolveReferenceNames(plan, dto, tenantId);

        // 状态：先认前端码值，再认词表值；两个都没给就保持原样（新增场景由调用方补 draft）
        String word = dto.getStatus() != null
                ? PlanStatusDict.toWord(dto.getStatus())
                : PlanStatusDict.normalize(dto.getPlanStatus());
        if (word != null) {
            plan.setPlanStatus(word);
        }
    }

    /**
     * 处理"这一个框既可能是 ID、也可能是自由文本"的字段。
     *
     * <p>前端新增计划表单里作物 / 地块 / 负责人都是自由文本框，用户填的是"水稻"这种业务文本，
     * 而实体对应的是 BIGINT 列 —— 能解析成数字就进 ID 列，否则进同义的 name 列，
     * 页面靠 name 列展示，两边都不丢信息。</p>
     *
     * @param create true 时未下发的字段显式清空（新增语义）；false 时 null 表示"这次不改"
     */
    private void applyIdOrName(String rawId, String rawName,
                              Consumer<Long> idSetter,
                              Consumer<String> nameSetter,
                              boolean create) {
        if (rawId == null && rawName == null) {
            return;
        }
        String idText = trimToNull(rawId);
        String nameText = trimToNull(rawName);
        Long id = toLong(idText);
        if (id != null) {
            idSetter.accept(id);
        } else if (create) {
            idSetter.accept(null);
        }
        if (nameText != null) {
            nameSetter.accept(nameText);
        } else if (id == null && idText != null) {
            // 前端把"作物"这类自由文本塞在 ID 字段里，落到 name 列才存得住
            nameSetter.accept(idText);
        } else if (create) {
            nameSetter.accept(null);
        }
    }

    private List<String> resolveStatusFilter(Integer status, String planStatus) {
        if (status != null) {
            return PlanStatusDict.wordsOf(status);
        }
        String word = PlanStatusDict.normalize(planStatus);
        return word == null ? Collections.emptyList() : Collections.singletonList(word);
    }

    /**
     * 按 ID 补齐农场 / 地块的名称列（页面列表与详情读的是 name 列）。
     *
     * <p>为什么要补：实体里 ID 与名称是两列，页面展示走名称。此前只下发 ID 时名称留空，
     * 计划列表的「地块」列、详情页的「关联地块 / 所属农场」就都显示 "-"，看着像"没关联上"
     * （2026-10-16 实测：{@code POST /plans {"plotId":"238"}} → {@code plot_id=238} /
     * {@code plot_name=NULL}）。名称取自本服务的地块 / 农场台账，是**有来源的派生**，不是编数据。</p>

     *
     * <p>两边校验口径**故意不同**：</p>
     * <ul>
     *   <li><b>地块</b>：本次请求真的下发了地块 ID 而本租户查不到 → 400。悬空关联会让
     *       "关联地块"变成一句空话（列表点进去没有地），宁可当场报错。</li>
     *   <li><b>农场</b>：查不到不拦，只留空 name。农场 ID 是页面按当前农场上下文自动带上的，
     *       历史数据里也存在指向演示农场的行，不该因为"补不出名字"就拦住保存。</li>
     * </ul>
     *
     * <p>注意：只在**本次请求下发了该字段**时才处理。编辑弹窗不下发地块时保持原值 ——
     * 否则旧数据里已存在的悬空 ID 会让"只改个名字"都存不回去。</p>
     *
     * @param plan 正在组装的实体
     * @param dto 请求体（用来判断本次是否下发了该字段）
     * @param tenantId 当前租户
     */
    private void resolveReferenceNames(PlantingPlan plan, PlantingPlanSaveDTO dto, String tenantId) {
        if (trimToNull(dto.getFarmId()) != null && plan.getFarmId() != null && isBlank(dto.getFarmName())) {
            Farm farm = farmMapper.selectOne(new LambdaQueryWrapper<Farm>()
                    .eq(Farm::getTenantId, tenantId)
                    .eq(Farm::getId, plan.getFarmId())
                    .last("LIMIT 1"));
            if (farm != null) {
                plan.setFarmName(farm.getFarmName());
            }
        }
        // 三个引用各自独立处理：**不能**共用一个方法里的提前 return，
        // 否则"只填负责人不选地块"时负责人会被整段跳过（写这版时先踩了一次）。
        resolvePlotName(plan, dto, tenantId);
        resolveManager(plan, dto, tenantId);
        resolveCrop(plan, dto, tenantId);
    }

    /**
     * 作物：落到 {@code crop_id}（主数据主键）+ {@code crop_name}（主数据名称）。

     *
     * <p>作物已经是主数据（{@code agri_prod_crop_info}），所以这里**必须解析得到**：
     * 下发的是作物主键（数字）或作物名称，两者都按主数据台账认；认不出就 400 ——
     * 作物是计划里唯一"必填且有权威口径"的字段，落一个主数据里没有的名字等于又回到自由文本。</p>

     *
     * <p>本次请求没下发作物就保持原值（编辑保存时不下发不会被清空）。</p>
     */
    private void resolveCrop(PlantingPlan plan, PlantingPlanSaveDTO dto, String tenantId) {
        String raw = trimToNull(dto.getCropId());
        String rawName = trimToNull(dto.getCropName());
        if (raw == null && rawName == null) {
            return;
        }
        Long pk = toLong(raw);
        CropInfo crop = pk != null
                ? cropMapper.selectById(pk)
                : cropMapper.selectOne(new LambdaQueryWrapper<CropInfo>()
                        .eq(CropInfo::getTenantId, tenantId)
                        .eq(CropInfo::getCropName, raw != null ? raw : rawName)
                        .last("LIMIT 1"));
        if (crop == null || !tenantId.equals(crop.getTenantId())) {
            throw new BusinessException(400, "作物不存在（请先在「作物管理」里维护）："
                    + (raw != null ? raw : rawName));
        }
        plan.setCropId(crop.getId());
        plan.setCropName(crop.getCropName());
    }

    /**
     * 地块：本次请求下发了地块就按台账补名称、并校验地块真实存在（口径见 {@link #resolveReferenceNames}）。
     */
    private void resolvePlotName(PlantingPlan plan, PlantingPlanSaveDTO dto, String tenantId) {
        if (trimToNull(dto.getPlotId()) == null) {
            return;
        }
        Long plotId = plan.getPlotId();
        if (plotId == null) {
            // 下发的是"水稻"这类业务文本：applyIdOrName 已把它落进 name 列，没有 ID 可校验
            return;
        }
        Plot plot = plotMapper.selectOne(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getTenantId, tenantId)
                .eq(Plot::getId, plotId)
                .last("LIMIT 1"));
        if (plot == null) {
            throw new BusinessException(400, "地块不存在（本租户内查不到该地块）：" + plotId);
        }
        // 以台账为准覆盖名称（调用方没显式给名称时）。**不能**只判断"当前名称为空"：
        // 编辑时实体的 plot_name 是上一次的旧值，改成空判断会让"换了地块、名字还是旧地块的"
        // （2026-10-16 实测：plot_id 238→239 后 plot_name 仍是「A区连栋大棚」，列表显示错误的地块）。
        if (isBlank(dto.getPlotName())) {
            plan.setPlotName(plot.getPlotName());
        }
    }

    /**
     * 把负责人落到「成员主键 + 真实姓名」。
     *
     * <p>为什么不能只靠 {@code applyIdOrName}：负责人列 {@code manager_id} 是 BIGINT，
     * 而成员的业务标识是 {@code DEMO-MEM-001} 这种字符串 —— 直接下发只会被当成"自由文本"
     * 落进 {@code manager_name}，页面上就会出现"负责人 = DEMO-MEM-001"。
     * 这里按台账解析一次：给出的是成员主键（数字）或成员业务标识（字符串）都能认。</p>

     *
     * <p>口子与地块一致：本次请求真的下发了负责人才处理；本租户查不到 → 400
     * （列表「负责人」列靠 {@code manager_name} 展示，挂个查不到的 ID 等于显示空白）。</p>
     */
    private void resolveManager(PlantingPlan plan, PlantingPlanSaveDTO dto, String tenantId) {
        String raw = dto.getOwnerId() != null ? dto.getOwnerId() : dto.getManagerId();
        String rawText = trimToNull(raw);
        if (rawText == null) {
            return;
        }
        // 数字 → 按成员主键查；否则 → 按成员业务标识查（页面/脚本两种下发方式都支持）
        Long pk = toLong(rawText);
        TeamMember member = pk == null
                ? memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                        .eq(TeamMember::getTenantId, tenantId)
                        .eq(TeamMember::getMemberId, rawText)
                        .last("LIMIT 1"))
                : memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                        .eq(TeamMember::getTenantId, tenantId)
                        .eq(TeamMember::getId, pk)
                        .last("LIMIT 1"));
        if (member == null) {
            throw new BusinessException(400, "负责人不存在（本租户内查不到该成员）：" + rawText);
        }
        plan.setManagerId(member.getId());
        // 名称同样以台账为准（除非调用方显式给了 managerName），避免换了负责人名字还是旧的
        if (isBlank(dto.getManagerName())) {
            plan.setManagerName(member.getMemberName());
        }
    }

    /**
     * 取计划并校验归属。
     *
     * <p>越权与不存在都返回 404：区分开等于告诉调用方"这条记录存在，只是不属于你"。</p>
     */
    private PlantingPlan getOwned(Long id, String tenantId) {
        PlantingPlan plan = this.getById(id);
        if (plan == null || !tenantId.equals(plan.getTenantId())) {
            throw new BusinessException(404, "种养计划不存在：" + id);
        }
        return plan;
    }

    /** 计划结束日期不能早于开始日期（两侧都给了才判定）。 */
    private void assertDateRange(PlantingPlan plan) {
        if (plan.getStartDate() != null && plan.getEndDate() != null
                && plan.getEndDate().before(plan.getStartDate())) {
            throw new BusinessException(400, "计划结束日期不能早于开始日期");
        }
    }

    /**
     * 同一地块同时段只允许一个"在种"计划（PRD R-PLAN-01）。
     *
     * <p>只有在种态才占用地块：草稿 / 已完结 / 已取消都不参与判定，
     * 否则一个已完成的计划会永远拦住这块地上的下一个计划（过度拦截比漏判更难发现）。
     * 地块或日期任一侧缺失时无法判定重叠，跳过校验（不误杀）。</p>
     */
    private void assertNoGrowingConflict(PlantingPlan plan) {
        if (plan.getPlotId() == null) {
            return;
        }
        if (plan.getStartDate() == null || plan.getEndDate() == null) {
            return;
        }
        if (!PlanStatusDict.ACTIVE.equals(plan.getPlanStatus())) {
            return;
        }
        List<PlantingPlan> conflicts = this.list(new LambdaQueryWrapper<PlantingPlan>()
                .eq(PlantingPlan::getTenantId, plan.getTenantId())
                .eq(PlantingPlan::getPlotId, plan.getPlotId())
                .eq(PlantingPlan::getPlanStatus, PlanStatusDict.ACTIVE)
                .ne(plan.getId() != null, PlantingPlan::getId, plan.getId())
                .le(PlantingPlan::getStartDate, plan.getEndDate())
                .ge(PlantingPlan::getEndDate, plan.getStartDate())
                .last("LIMIT 1"));
        if (conflicts.isEmpty()) {
            return;
        }
        PlantingPlan conflict = conflicts.get(0);
        throw new BusinessException(409, String.format(
                "地块 %s 在 %s ~ %s 期间已存在在种计划：planId=%s，计划名称=%s，负责人=%s",
                plan.getPlotId(), fmt(plan.getStartDate()), fmt(plan.getEndDate()),
                conflict.getId(),
                conflict.getPlanName() == null ? "（未命名）" : conflict.getPlanName(),
                conflict.getManagerName() == null ? "（未指派）" : conflict.getManagerName()));
    }

    /** 生成同租户内唯一的计划编码：PLAN-yyyyMMdd-4 位随机。 */
    private String nextPlanCode(String tenantId) {
        String day = LocalDate.now().format(CODE_DAY);
        for (int i = 0; i < 8; i++) {
            String code = "PLAN-" + day + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            long used = this.count(new LambdaQueryWrapper<PlantingPlan>()
                    .eq(PlantingPlan::getTenantId, tenantId)
                    .eq(PlantingPlan::getPlanCode, code));
            if (used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成计划编码失败，请稍后重试");
    }

    /**
     * 解析日期入参。
     *
     * <p>前端 ProFormDatePicker 提交的是 dayjs，经 api 层归一化成 yyyy-MM-dd；
     * 直接调接口的人可能带上时间部分，这里两者都收，格式不对时明确报错而不是静默丢日期。</p>
     */
    private Date parseDate(String value) {
        String text = trimToNull(value);
        if (text == null) {
            return null;
        }
        if (text.length() > 10) {
            text = text.substring(0, 10);
        }
        try {
            return Date.from(LocalDate.parse(text).atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式不正确：" + value + "（应为 yyyy-MM-dd）");
        }
    }

    private static LocalDate toLocalDate(Date value) {
        return value.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    /**
     * 把日期渲染成 yyyy-MM-dd。
     *
     * <p>直接拼 {@code Date} 会把它的 {@code toString()} 塞进提示语（实测长这样：
     * "Fri May 01 00:00:00 CST 2026"）—— 这句提示是要给农户看的，必须是页面上的日期格式。</p>
     */
    private static String fmt(Date value) {
        if (value == null) {
            return "（未填）";
        }
        return toLocalDate(value).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    }

    private static Long toLong(String value) {
        String text = trimToNull(value);
        if (text == null) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
