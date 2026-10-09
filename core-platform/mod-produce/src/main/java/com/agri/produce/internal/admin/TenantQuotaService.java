package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
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
 */
@Service
@RequiredArgsConstructor
public class TenantQuotaService {

    private static final String ID_PREFIX = "QUOT";

    /** 配额预警阈值（%）：最高使用率达到该值即计入「仅看预警」 */
    private static final double WARNING_THRESHOLD = 80D;

    private final TenantQuotaMapper tenantQuotaMapper;
    private final FarmInfoMapper farmInfoMapper;

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
     * 重置已用计数（按实际表重算）——<b>当前实现明确失败，不写回任何数字</b>。
     *
     * <p>原实现为 {@code farmInfoMapper.selectCount(new LambdaQueryWrapper<>()).intValue()}，
     * 即「全平台农场总数」，却写进<b>单个租户</b>的 used_farm_count：
     * 多租户下会把别家农场的用量记到本租户头上，且返回值/HTTP 状态一切正常，
     * 是典型的静默说假话（实测把 used_farm_count 从 4 静默改成了 0）。
     *
     * <p><b>为什么不能直接补 {@code .eq(FarmInfoEntity::getTenantId, quota.getTenantId())}：</b>
     * 全库 tenant_id 由 {@code MyMetaObjectHandler#insertFill} 统一硬编码填充为 {@code 0}
     * （全仓无任何业务代码 setTenantId），库内也没有租户主表，
     * TenantLineInnerInterceptor 的租户列实际是 market_id 而非 tenant_id。
     * 该条件能编译、能跑、还能把数字从「全平台总数」变成「1」——<b>看起来像修好了，实际更错</b>。
     *
     * <p>因此：租户维度未打通时正确值不可达。此处既不写全平台总数、也不写 0（都是假数字），
     * 而是抛业务异常让调用方立刻感知，保证 used_farm_count 不被污染。
     *
     * <p><b>恢复方式（待租户 PRD 口径确定、租户维度打通后）</b>：把下面的 throw 替换为按租户维度的
     * 真实统计即可，例如
     * {@code quota.setUsedFarmCount(farmInfoMapper.selectCount(new LambdaQueryWrapper<FarmInfoEntity>()}
     * {@code .eq(FarmInfoEntity::getTenantId, quota.getTenantId())).intValue());}
     * ，随后 {@code tenantQuotaMapper.updateById(quota); return quota;}。
     * 在此之前请勿放开本方法。
     *
     * @param quotaId 配额主键
     * @return 不会正常返回；配额不存在时抛 NOT_FOUND，存在时抛租户维度未打通的业务异常
     * @throws BusinessException 配额不存在（404）；或租户维度未打通、无法按租户重算（1000）
     */
    @Transactional
    public TenantQuotaEntity resetUsage(String quotaId) {
        TenantQuotaEntity quota = detail(quotaId);
        throw new BusinessException(ErrorCode.BIZ_ERROR,
                "配额用量重算暂不可用：租户维度未打通（tenant_id 由框架恒填 0、无租户主表、"
                        + "隔离列实为 market_id），无法按租户统计农场数；为避免写入错误数值，"
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
        items.add(OpsQuotaItem.of("traceCode", "溯源码", "个", 0D,
                quota.getTraceCodeLimit() == null ? 0D : quota.getTraceCodeLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 0, OpsQuotaItem.SOURCE_NONE));
        items.add(OpsQuotaItem.of("storage", "存储空间", "GB", 0D,
                quota.getStorageLimitGb() == null ? 0D : quota.getStorageLimitGb().doubleValue(),
                2, text(quota.getUpdatedAt()), quota.getQuotaId(), 5, OpsQuotaItem.SOURCE_NONE));
        items.add(OpsQuotaItem.of("api", "API 调用", "次/日", 0D,
                quota.getApiCallLimit() == null ? 0D : quota.getApiCallLimit().doubleValue(),
                0, text(quota.getUpdatedAt()), quota.getQuotaId(), 6, OpsQuotaItem.SOURCE_NONE));
        return items;
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
