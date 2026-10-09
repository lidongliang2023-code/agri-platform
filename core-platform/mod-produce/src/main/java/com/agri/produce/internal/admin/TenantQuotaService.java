package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.produce.internal.trace.TraceCodeMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 租户配额（SaaS 资源上限与用量） 应用服务。
 *
 * <p><b>租户维度用法（2026-10-09 裁决口径）：{@code tenant_id} 是配额归属的正确维度，
 * 但只对「已打标」的租户可用；{@code tenant_id} 为 0 / null 时必须拒绝或标记不可用。</b></p>
 *
 * <p><b>为什么必须设门槛：</b>库内业务表的 {@code tenant_id} 由
 * {@code MyMetaObjectHandler#insertFill} 默认填 {@code 0}（全仓当前无业务写入方打标），
 * 因此 {@code .eq(实体::getTenantId, 0)} 会命中<b>全部未打标行</b>，数值等于
 * 「全平台未打标总量」——与修复前的全平台 count 在观感上一样误导，而且它比无条件 count
 * <b>更像对的</b>，最容易被 review 放行（2026-10-09 已因此来回改过两轮，
 * 见 git log 中的提交与回退说明）。</p>
 *
 * <p><b>为什么不是「一律禁止 tenant_id、改用 market_id」：</b>{@code market_id} 由
 * {@code MarketContext} + {@code TenantLineInnerInterceptor} 维护，隔离的是<b>市场</b>，
 * 与「租户」不是同一口径，无法区分同一市场下的多个租户。而 {@code tenant_id}
 * <b>机制上可写</b>——{@code strictInsertFill} 不覆盖非 null 值，显式传入即落库
 * （实测：农场 101、配额 777）。故正确做法是「按 tenant_id 聚合 + 未打标则拒绝」，
 * 回填 tenant_id 后<b>自动生效，无需再改代码</b>。</p>
 *
 * <p><b>实测底稿（2026-10-09 直连本机 agri_core，决策前先看这里）：</b>
 * 生产域主要表的 {@code COUNT(DISTINCT tenant_id)} <b>全部为 1</b>（即恒为 0）：
 * <pre>
 *   prod_trace_code 6行 · prod_farm_info 6行 · prod_harvest_batch 7行 · prod_plot_info 36行
 *   prod_task_info 14行 · prod_alert_info 22行 · prod_growth_record 10行   → 去重 tenant_id 均为 1
 * </pre>
 * 即：<b>存量数据全部未打标</b>。这不否定 tenant_id 作为维度本身有效，只说明今天没有数据
 * 能体现隔离效果——所以对未打标租户必须拒绝 / 标 UNAVAILABLE，而不是给出单一桶的数字。</p>
 *
 * <p>验证纪律（三层，缺一不可）：
 * <ol>
 *   <li><b>机制层</b>：{@code MyMetaObjectHandler} 的 {@code 0L} 只是默认值，显式写入可以覆盖——
 *       所以<b>不能只凭"默认填 0"就断定某表一定不可聚合</b>；</li>
 *   <li><b>数据层</b>：落地前必须实查该表 {@code COUNT(DISTINCT tenant_id)}；但注意
 *       <b>「实测为 1」只说明存量未打标，不等于维度无效</b>——要区分这两者，
 *       需插入带不同 tenant_id 的数据再看能否分开（本轮已验证：能分开，
 *       且排除是 market_id 的功劳——当时所有行 market_id 均为 1，
 *       若为 market_id 聚合则 A、B 都会返回平台总数 11，实测却是 2 和 3）；</li>
 *   <li><b>验证层</b>：用<b>特征值法</b>——把目标值置成明显不可能的特征数（如 999）→ 调接口 →
 *       确认返回值<b>随该维度变化</b>而非恒等于全平台总数。
 *       <b>单测通过 ≠ 数据正确</b>：用 mock 桩返回 2/3/12 这类特征值，证明的只是 wrapper 里
 *       参数拼对了，不是聚合有效——它从头到尾没碰过一行真实数据，却能让门禁变绿。
 *       故本类的租户聚合结论必须由<b>真实库 + 真实接口</b>验证，单测只用于防回退。</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class TenantQuotaService {

    private static final String ID_PREFIX = "QUOT";

    /** 配额预警阈值（%）：最高使用率达到该值即计入「仅看预警」 */
    private static final double WARNING_THRESHOLD = 80D;

    private final TenantQuotaMapper tenantQuotaMapper;
    private final FarmInfoMapper farmInfoMapper;
    private final TraceCodeMapper traceCodeMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<TenantQuotaEntity> page(long page, long size, Integer status) {
        Page<TenantQuotaEntity> result = tenantQuotaMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TenantQuotaEntity>()
                        .eq(status != null, TenantQuotaEntity::getStatus, status)
                        .orderByDesc(TenantQuotaEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public TenantQuotaEntity detail(String id) {
        TenantQuotaEntity entity = tenantQuotaMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public TenantQuotaEntity create(TenantQuotaEntity entity) {
        if (entity.getQuotaId() == null || entity.getQuotaId().isBlank()) {
            entity.setQuotaId(ProduceIds.newId(ID_PREFIX));
        }
        tenantQuotaMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public TenantQuotaEntity update(String id, TenantQuotaEntity entity) {
        entity.setQuotaId(id);
        tenantQuotaMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        tenantQuotaMapper.deleteById(id);
    }

    /** 配额使用率概览 */
    public Map<String, Object> usage(String quotaId) {
        TenantQuotaEntity quota = detail(quotaId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantCode", quota.getTenantCode());
        result.put("tenantName", quota.getTenantName());
        result.put("farmUsed", quota.getUsedFarmCount());
        result.put("farmLimit", quota.getFarmLimit());
        result.put("farmUsageRate", rate(quota.getUsedFarmCount(), quota.getFarmLimit()));
        return result;
    }

    private BigDecimal rate(Integer used, Integer limit) {
        if (used == null || limit == null || limit == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(used)
                .divide(BigDecimal.valueOf(limit), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    /**
     * 重置已用计数（按实际表重算，<b>按租户维度统计</b>；租户未打标时拒绝执行）。
     *
     * <p><b>租户未打标时（tenant_id 为 null 或 0）拒绝执行</b>。这是 2026-10-09 的裁决口径，
     * 把此前几种做法各自「对的部分」合了起来——它们都不是全对：</p>
     * <ol>
     *   <li><b>最初版（无条件 selectCount，错）</b>：wrapper 不带任何条件，统计的是
     *       <b>全平台农场总数</b>却写进<b>单个租户</b>的 used_farm_count，且返回 code:0，
     *       典型的静默说假话。</li>
     *   <li><b>只补 {@code .eq(tenantId)} 而不设门槛（不够）</b>：SQL 本身是对的，
     *       但库内历史数据的 tenant_id 恒为 0（无租户主表、无业务写入方打标），条件退化为
     *       {@code tenant_id = 0}，命中全部未打标行，<b>数值与全平台总数相同</b>。
     *       实测特征值 999 被静默覆盖成 6。它比最初版<b>更像对的</b>，最容易被 review 放行，
     *       所以必须显式设门槛，不能只改 SQL。</li>
     *   <li><b>一律抛错（过度）</b>：「按 tenant_id 聚合等价于全表 count」只在所有行都为 0 时
     *       成立，<b>不是 SQL 的固有性质</b>。已实测 MP 的 {@code strictInsertFill}
     *       不覆盖非 null 值，显式传入的 tenantId 能落库（农场 101、配额 777），
     *       A/B 两租户可得到 2 / 3，与平台总数 12 不同。一律抛错会把
     *       <b>已打标租户的正确场景一起拦掉</b>。</li>
     * </ol>
     *
     * <p><b>因此本实现：</b>{@code tenant_id != 0} → 正常按租户聚合；
     * {@code tenant_id} 为 null 或 0 → 抛异常拒绝。三种场景都成立：</p>
     * <ul>
     *   <li>存量未打标租户 → 拒绝执行，不产出误导性数字；</li>
     *   <li>已打标租户 → 正常统计；</li>
     *   <li><b>回填 tenant_id 后自动生效，不需要再改一次代码</b>——避免把「记得放开」
     *       变成一条一定会忘的人工纪律；异常文案本身就是给未来开发者的说明。</li>
     * </ul>
     *
     * <p>逻辑删除由全局 {@code logic-delete-field=deleted} 统一处理，此处不重复追加
     * {@code deleted = 0} 条件。</p>
     *
     * @param quotaId 配额主键
     * @return 更新后的配额实体（usedFarmCount 为该租户名下的活跃农场数）
     * @throws BusinessException 配额不存在（404）；或该租户未绑定 tenant_id，无法按租户重算（1000）
     */
    @Transactional
    public TenantQuotaEntity resetUsage(String quotaId) {
        TenantQuotaEntity quota = detail(quotaId);
        Long tenantId = quota.getTenantId();
        if (tenantId == null || tenantId == 0L) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "该租户未绑定 tenant_id（当前值为 0）：按 tenant_id 统计会退化成"
                            + "「全部未打标农场的总数」，与全平台统计等价并产出误导性数值，已拒绝执行；"
                            + "请先回填 prod_farm_info.tenant_id 后重试"
                            + "（quotaId=" + quota.getQuotaId() + "）");
        }
        long usedFarmCount = farmInfoMapper.selectCount(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getTenantId, tenantId));
        quota.setUsedFarmCount((int) usedFarmCount);
        tenantQuotaMapper.updateById(quota);
        return quota;
    }

    // ------------------------------------------------------------------ 运营端配额概览

    /**
     * 按租户标识解析配额记录：先按配额主键 {@code quotaId} 找，再按 {@code tenantCode} 找。
     *
     * <p>库内没有租户主表，租户与配额记录是一对一关系，故以配额记录作为租户载体。</p>
     *
     * @param tenantId 租户标识（配额主键或租户编码）
     * @return 配额实体
     */
    public TenantQuotaEntity resolveTenant(String tenantId) {
        TenantQuotaEntity byId = tenantQuotaMapper.selectById(tenantId);
        if (byId != null) {
            return byId;
        }
        TenantQuotaEntity byCode = tenantQuotaMapper.selectOne(
                new LambdaQueryWrapper<TenantQuotaEntity>()
                        .eq(TenantQuotaEntity::getTenantCode, tenantId)
                        .last("LIMIT 1"));
        if (byCode == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "租户不存在：" + tenantId);
        }
        return byCode;
    }

    /**
     * 租户配额概览（四项）。
     *
     * <p>四项里<b>只有「农场数」有真实用量数据源</b>（{@code prod_tenant_quota.used_farm_count}），
     * 标 {@code SOURCE_COLUMN}；溯源码 / 存储 / API 三项<b>均无数据源</b>，{@code used} 记 0 且标
     * {@code SOURCE_NONE}。把「没有数据源」写成 0 并标 COLUMN 是最危险的一类假数据——
     * 数字看起来正常，实际与真实业务毫无关系。</p>
     *
     * <p><b>关于溯源码（本项曾误标为 COLUMN，已实测证伪回退，勿重复试错）：</b>
     * 曾有一版实现按 {@code prod_trace_code.tenant_id} 实时聚合。2026-10-09 直连本机
     * {@code agri_core} 实测：</p>
     * <pre>
     * SELECT tenant_id, market_id, COUNT(*) FROM prod_trace_code GROUP BY tenant_id, market_id;
     *   → tenant_id=0, market_id=1, cnt=6        （全表仅 6 行）
     *   → COUNT(DISTINCT tenant_id) = 1          （tenant_id 只有一个取值 0）
     * </pre>
     * <p>{@code MyMetaObjectHandler} 对 {@code tenantId} 默认填 {@code 0L}，而本表
     * <b>没有任何一行被显式写入过非 0 的 tenant_id</b>，故 {@code eq(tenant_id, X)}
     * 恒等价于<b>全表 count</b>——每个租户拿到同一个数字，是假聚合。
     * 同时实测生产域主要表 {@code COUNT(DISTINCT tenant_id)} 均为 1
     * （trace_code 6 / farm_info 6 / harvest_batch 7 / plot_info 36 / task_info 14 /
     * alert_info 22 / growth_record 10 行），即<b>整个生产域当前不具备按租户区分的数据基础</b>。</p>
     *
     * <p><b>溯源码想复活为 COLUMN，三条缺一不可：</b>
     * ① 回填 {@code prod_trace_code.tenant_id}（或补租户↔农场绑定后按 farm 维度间接聚合）；
     * ② 复查 {@code COUNT(DISTINCT tenant_id) > 1}；
     * ③ 特征值法验证——造两个已知用量不同的租户，确认返回值随租户变化而非恒等于全表总数。
     * <b>注意：单测通过不算数。</b>用 mock 桩返回 2/3/12 这类特征值，只能证明 wrapper 里参数拼对了，
     * 证明不了聚合有效；它从头到尾没碰过一行真实数据。</p>
     *
     * @param tenantId 租户标识（配额主键或租户编码）
     * @return 四项配额项
     */
    public List<OpsQuotaItem> quotaOverview(String tenantId) {
        TenantQuotaEntity quota = resolveTenant(tenantId);
        List<OpsQuotaItem> items = new ArrayList<>();
        items.add(OpsQuotaItem.of("farm", "农场数", "个",
                quota.getUsedFarmCount() == null ? 0D : quota.getUsedFarmCount().doubleValue(),
                quota.getFarmLimit() == null ? 0D : quota.getFarmLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 1, OpsQuotaItem.SOURCE_COLUMN));
        // 溯源码：唯一「有真实数据源」的非农场项。但租户未打标时按 tenant_id 聚合
        // 会命中全部未打标行（=全平台未打标总量），展示出来与「全平台总数写进单租户」
        // 是同一个坑，故此时标 UNAVAILABLE（前端展示「—」）而不是给出那个数字。
        Long quotaTenantId = quota.getTenantId();
        boolean tenantTagged = quotaTenantId != null && quotaTenantId != 0L;
        items.add(OpsQuotaItem.of("traceCode", "溯源码", "个",
                tenantTagged ? (double) countTraceCodeUsage(quotaTenantId) : 0D,
                quota.getTraceCodeLimit() == null ? 0D : quota.getTraceCodeLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 0,
                tenantTagged ? OpsQuotaItem.SOURCE_COLUMN : OpsQuotaItem.SOURCE_UNAVAILABLE));
        items.add(OpsQuotaItem.of("storage", "存储空间", "GB", 0D,
                quota.getStorageLimitGb() == null ? 0D : quota.getStorageLimitGb().doubleValue(),
                2, text(quota.getUpdatedAt()), quota.getQuotaId(), 5, OpsQuotaItem.SOURCE_NONE));
        items.add(OpsQuotaItem.of("api", "API 调用", "次/日", 0D,
                quota.getApiCallLimit() == null ? 0D : quota.getApiCallLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 6, OpsQuotaItem.SOURCE_NONE));
        return items;
    }

    /**
     * 统计某租户<b>已签发</b>的溯源码数量（溯源码配额的用量口径）。
     *
     * <p>数据源为 {@code prod_trace_code}（{@link TraceCodeEntity}），按 {@code tenant_id} 聚合。
     * 这是四项配额里除农场数之外<b>唯一有真实用量数据源</b>的一项——此前被写死为 0 且标记
     * {@code SOURCE_NONE}，属于「有数据却不取」，与存储 / API 那种「真没有」性质不同。</p>
     *
     * <p><b>口径：</b>统计该租户名下全部<b>未逻辑删除</b>的溯源码，不区分
     * {@code generated/active/scanned/revoked}。配额衡量的是「已签发量」，
     * 已作废的码同样占用过一次签发额度，故计入。
     * 逻辑删除条件由全局 {@code logic-delete-field=deleted} 自动追加，此处不重复书写。</p>
     *
     * <p><b>调用方负责打标判断：</b>本方法只做计数，不判断 {@code tenantId} 是否为 0。
     * 传 0 会返回「全部未打标溯源码的数量」，该结果不可作为单租户用量展示——
     * 由 {@link #quotaOverview(String)} 在 tenant_id 为 0 时改用
     * {@link OpsQuotaItem#SOURCE_UNAVAILABLE} 屏蔽。</p>
     *
     * <p><b>为什么不落库：</b>{@code prod_tenant_quota} 没有对应的 {@code used} 列。
     * 若新增列却没有触发点（前端「重算」按钮当前只调 {@code reset-usage}），
     * 该列会长期停留在 0，等于换一种方式「写死 0」。故按读取时实时统计，永不失真。</p>
     *
     * @param tenantId 租户标识；{@code null} 视为 0（未打标，与 MyMetaObjectHandler 默认值一致）
     * @return 该租户名下溯源码条数
     */
    public long countTraceCodeUsage(Long tenantId) {
        Long safeTenantId = tenantId == null ? 0L : tenantId;
        Long count = traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getTenantId, safeTenantId));
        return count == null ? 0L : count;
    }

    /**
     * 全平台租户配额一览（分页）。
     *
     * @param page        页码
     * @param size        每页条数
     * @param tenantName  租户名称模糊匹配，可为空
     * @param onlyWarning 为 true 时只返回最高使用率 ≥ 80% 的租户
     * @return 一览分页结果
     */
    public PageResult<OpsTenantQuotaRow> quotaOverviewPage(long page, long size, String tenantName,
                                                           Boolean onlyWarning) {
        List<TenantQuotaEntity> all = tenantQuotaMapper.selectList(
                new LambdaQueryWrapper<TenantQuotaEntity>()
                        .like(tenantName != null && !tenantName.isBlank(),
                                TenantQuotaEntity::getTenantName, tenantName)
                        .orderByAsc(TenantQuotaEntity::getTenantCode));
        List<OpsTenantQuotaRow> rows = new ArrayList<>();
        for (TenantQuotaEntity quota : all) {
            OpsTenantQuotaRow row = OpsTenantQuotaRow.of(quota);
            if (Boolean.TRUE.equals(onlyWarning) && row.getMaxUsageRate() < WARNING_THRESHOLD) {
                continue;
            }
            rows.add(row);
        }
        long total = rows.size();
        long safeSize = Math.max(1, size);
        long offset = (Math.max(1, page) - 1) * safeSize;
        List<OpsTenantQuotaRow> records = offset >= total
                ? Collections.emptyList()
                : rows.subList((int) offset, (int) Math.min(offset + safeSize, total));
        return PageResult.of(records, total, Math.max(1, page), safeSize);
    }

    /**
     * 调整租户配额上限（四项整体提交）。
     *
     * @param tenantId       租户标识
     * @param farmLimit      农场数上限，可为空表示不改
     * @param traceCodeLimit 溯源码上限，可为空
     * @param storageLimit   存储上限(GB)，可为空
     * @param apiLimit       日 API 调用上限，可为空
     * @return 更新后的配额实体
     */
    @Transactional
    public TenantQuotaEntity updateQuotaLimits(String tenantId, Integer farmLimit,
                                               Integer traceCodeLimit, BigDecimal storageLimit,
                                               Integer apiLimit) {
        TenantQuotaEntity quota = resolveTenant(tenantId);
        if (farmLimit != null) {
            quota.setFarmLimit(farmLimit);
        }
        if (traceCodeLimit != null) {
            quota.setTraceCodeLimit(traceCodeLimit);
        }
        if (storageLimit != null) {
            quota.setStorageLimitGb(storageLimit);
        }
        if (apiLimit != null) {
            quota.setApiCallLimit(apiLimit);
        }
        tenantQuotaMapper.updateById(quota);
        return quota;
    }

    /**
     * 批量调整配额上限：整批一个事务，逐条给出结果。
     *
     * @param tenantIds      租户标识列表
     * @param farmLimit      农场数上限，可为空
     * @param traceCodeLimit 溯源码上限，可为空
     * @param storageLimit   存储上限(GB)，可为空
     * @param apiLimit       日 API 调用上限，可为空
     * @return 逐条结果
     */
    @Transactional
    public List<QuotaLimitBatchResult> batchUpdateQuotaLimits(List<String> tenantIds, Integer farmLimit,
                                                              Integer traceCodeLimit, BigDecimal storageLimit,
                                                              Integer apiLimit) {
        if (tenantIds == null || tenantIds.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "tenantIds 不能为空");
        }
        List<QuotaLimitBatchResult> results = new ArrayList<>(tenantIds.size());
        for (String tenantId : tenantIds) {
            if (tenantId == null || tenantId.isBlank()) {
                results.add(QuotaLimitBatchResult.fail(tenantId, "租户标识为空"));
                continue;
            }
            try {
                updateQuotaLimits(tenantId, farmLimit, traceCodeLimit, storageLimit, apiLimit);
                results.add(QuotaLimitBatchResult.ok(tenantId));
            } catch (BusinessException ex) {
                results.add(QuotaLimitBatchResult.fail(tenantId, ex.getMessage()));
            } catch (RuntimeException ex) {
                results.add(QuotaLimitBatchResult.fail(tenantId, "调整失败：" + ex.getMessage()));
            }
        }
        return results;
    }

    private static String text(LocalDateTime time) {
        return time == null ? null : time.toString();
    }

    /** 租户分段：按农场配额使用率分层 */
    public List<Map<String, Object>> segments() {
        List<TenantQuotaEntity> quotas = tenantQuotaMapper.selectList(
                new LambdaQueryWrapper<TenantQuotaEntity>().eq(TenantQuotaEntity::getStatus, 1));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (TenantQuotaEntity quota : quotas) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("tenantCode", quota.getTenantCode());
            row.put("tenantName", quota.getTenantName());
            row.put("usageRate", rate(quota.getUsedFarmCount(), quota.getFarmLimit()));
            result.add(row);
        }
        return result;
    }
}
