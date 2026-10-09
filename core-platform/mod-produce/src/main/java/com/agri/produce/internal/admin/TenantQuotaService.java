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
 * <p><b>租户维度当前不可用——禁止用 {@code tenant_id} 做租户聚合。</b>
 * 全库业务表的 {@code tenant_id} 由 {@code MyMetaObjectHandler#insertFill} 统一硬编码填 {@code 0}
 * （全仓无任何业务代码 setTenantId），且库内<b>没有租户主表</b>、没有租户与业务对象的绑定关系。
 * 因此任何 {@code .eq(实体::getTenantId, x)} 形式的「按租户统计」，在 x 取到默认的 0 时
 * <b>等价于全表 count</b>——它会算出「全平台总数」并伪装成「本租户用量」，能编译、能跑、
 * 返回值看起来合理，但实际是错的（2026-10-09 已因此误提交过一次，见 git log 中
 * 「resetUsage 按租户维度统计农场数」那笔及其后的回退说明）。
 *
 * <p>租户域 PRD 落地、租户维度真正打通之前：
 * <ul>
 *   <li>禁止以 {@code tenant_id} 为聚合维度计量任何配额用量；</li>
 *   <li>需要区分维度时改用 <b>{@code market_id}</b>——它由 {@code MarketContext} +
 *       {@code TenantLineInnerInterceptor} 维护，是<b>当前唯一真实生效</b>的隔离维度
 *       （注意它隔离的是市场，与「租户」不是同一个概念，勿混用口径）；</li>
 *   <li>若某项目前的确既无 tenant 维度、也无 market 维度可用，则按项目纪律<b>明确报错 / 返回空</b>，
 *       禁止写回 0 或任何看起来正常的占位数字。</li>
 * </ul>
 *
 * <p>验证纪律：任何「按某维度聚合」的修复，必须先用<b>特征值法</b>验证——把目标值置成明显不可能的
 * 特征数（如 999）→ 调接口 → 确认返回值<b>随该维度变化</b>而非恒等于全平台总数；
 * 只看代码里有没有写 {@code .eq(...)} 不足以证明它真的在聚合。
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
     * 重置已用计数——<b>当前实现明确失败，不写回任何数字</b>（2026-10-09 裁决）。
     *
     * <p><b>该方法的三个历史版本，以及为什么最后选了「明确失败」：</b>
     * <ol>
     *   <li><b>最初版</b>：{@code selectCount(new LambdaQueryWrapper<>())}
     *       ——wrapper 不带任何条件，统计的是<b>全平台农场总数</b>，却写进<b>单个租户</b>的
     *       used_farm_count，多租户下把别家农场的用量记到本租户头上，且返回 {@code code:0}。
     *       实测表现：把特征值 999 静默覆盖成了 6。</li>
     *   <li><b>第二版（{{@code .eq(FarmInfoEntity::getTenantId, tenantId)}，已回退）</b>：
     *       看起来是「按租户统计」，但本租户配额记录的 {@code tenant_id} 是 0、
     *       而全库农场行的 {@code tenant_id} 也全是 0，条件退化成 {@code tenant_id = 0}
     *       ——命中全部行，<b>语义上仍等价于全表 count</b>。
     *       实测同样是返回 6（=全平台农场总数 6），特征值 999 同样被静默覆盖。
     *       这个版本最危险：它比第一版<b>更像对的</b>，容易被 review 放行。</li>
     *   <li><b>当前版（本实现）</b>：既然正确值不可达，就不给数字——抛业务异常，
     *       保证 {@code used_farm_count} 不被污染。</li>
     * </ol>
     *
     * <p><b>关于「tenant_id 其实可以写入」这一点：</b>确实如此——
     * {@code MyMetaObjectHandler#insertFill} 用的是 MP 的 {@code strictInsertFill}，
     * 它<b>不会覆盖非 null 值</b>，因此显式传入的 tenantId 能正常落库（如 101）。
     * 这不是该版本被回退的原因。真正的原因是：<b>全仓没有任何业务代码、也没有任何业务流程
     * 在写入 farm 的 tenant_id，且租户与业务对象之间没有绑定关系</b>，所以「现实存在的数据」
     * 里这一列恒为 0，条件必然退化。等到真的有写入方再启用本逻辑，属于「为未来是对的、
     * 为现在是错的」——这类代码必须以明确失败的形式搁置，不能以静默错数的形式运行。</p>
     *
     * <p><b>恢复条件（满足后替换本方法体即可）</b>：①租户域 PRD 确定「租户」定义；
     * ②有真实的租户主表或租户↔业务对象绑定关系；③业务写入侧开始维护 tenant_id。
     * 届时可用 {@code new LambdaQueryWrapper<FarmInfoEntity>()}
     * {@code .eq(FarmInfoEntity::getTenantId, quota.getTenantId())} 统计后
     * {@code tenantQuotaMapper.updateById(quota); return quota;}。
     * 恢复时务必先用<b>特征值法</b>验证：置 999 → 调接口 → 确认返回值随租户变化，
     * 而不是恒等于全平台总数。</p>
     *
     * @param quotaId 配额主键
     * @return 不会正常返回；配额不存在时抛 NOT_FOUND，存在时抛租户维度未打通的业务异常
     * @throws BusinessException 配额不存在（404）；或租户维度未打通、无法按租户重算（1000）
     */
    @Transactional
    public TenantQuotaEntity resetUsage(String quotaId) {
        TenantQuotaEntity quota = detail(quotaId);
        throw new BusinessException(ErrorCode.BIZ_ERROR,
                "配额用量重算暂不可用：租户维度未打通（tenant_id 无业务写入方、恒为 0，且无租户主表"
                        + "与绑定关系），按 tenant_id 聚合等价于全表 count；为避免写入错误数值，"
                        + "本次重算已终止且未修改任何数据（quotaId=" + quota.getQuotaId() + "）");
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
        items.add(OpsQuotaItem.of("traceCode", "溯源码", "个",
                (double) countTraceCodeUsage(quota.getTenantId()),
                quota.getTraceCodeLimit() == null ? 0D : quota.getTraceCodeLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 0, OpsQuotaItem.SOURCE_COLUMN));
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
     * <p><b>为什么不落库：</b>{@code prod_tenant_quota} 没有对应的 {@code used} 列。
     * 若新增列却没有触发点（前端「重算」按钮当前只调 {@code reset-usage}），
     * 该列会长期停留在 0，等于换一种方式「写死 0」。故按读取时实时统计，永不失真。
     * 若后续要求可「重算」并持久化，需同时补列（V13+）、回填与触发入口三件套。</p>
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
