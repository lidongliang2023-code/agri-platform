package com.agri.produce.internal.trace;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 溯源码服务：生成 / 激活 / 扫码 / 作废，支撑「一物一码」贯穿交易与监管。
 */
@Service
@RequiredArgsConstructor
public class TraceService {

    private final TraceCodeMapper traceCodeMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final DomainEventPublisher eventPublisher;

    /** 码值碰撞后的最大重生成次数（四位随机后缀，单批次 9000 个可用值） */
    private static final int CODE_GENERATE_MAX_RETRY = 10;

    /**
     * 为已采收批次生成一物一码（初始状态 generated）。
     *
     * <p>入参是<b>业务批次号语义的字符串</b>，不是数据库主键，理由同 {@link #listByBatch(String)}。
     * 早先声明为 {@code Long} 会让所有采收批次 ID 在类型转换阶段就失败（HTTP 200 + 业务码 400），
     * 且查重走 {@code prod_trace_code.batch_id}（BIGINT）必然与采收批次（varchar）落空，
     * 导致同一批次被重复发码。</p>
     *
     * <p><b>关于 {@code batch_id} 的取值</b>：{@code prod_trace_code.batch_id} 是 V1 遗留的
     * {@code BIGINT} 列（源自 legacy {@code prod_batch} 的数字主键），而采收批次
     * （{@code prod_harvest_batch.batch_id}）是 varchar(32)，两者分处两个 ID 空间，
     * <b>不存在天然映射</b>。V13 已把该列改为可空，因此这里：
     * <ul>
     *   <li>对齐批次一律以 {@code batch_no} 为准（V2 补列，已建 idx_trace_batch_no）；</li>
     *   <li>{@code batch_id} <b>留空</b>，绝不合成无意义的数字去填——那会让每一行都成为
     *       与任何真实批次都关联不上的脏数据。</li>
     * </ul>
     *
     * <p><b>不再依赖 legacy {@code prod_batch}</b>：旧实现要求存在
     * {@code prod_batch.batch_code == 解析出的 batch_no} 才肯发码，而 legacy 表全库只有
     * 一行（{@code PH20260901001}），对不上任何采收批次，导致 DEMO-BATCH-001..006
     * 全部 404。现在只校验采收批次本身是否存在。</p>
     *
     * <p><b>一个批次可以有多个码</b>：{@code prod_trace_code} 的唯一键只有
     * {@code uk_trace_code (code)}（V1__init_core.sql:254-266），schema 层没有按批次的
     * 唯一约束；种子数据里 {@code DEMO-BATCHN-001} 本身就挂着 DEMO-TC-0001 与
     * DEMO-TC-0002 两个码。因此"一个批次只能有一个码"的
     * {@code TRACE_CODE_DUPLICATED} 守卫与既有数据自相矛盾，已移除。
     * 本方法语义是：<b>每次调用发一个新码</b>，唯一性由 {@code uk_trace_code} 保证。</p>
     *
     * <p><b>码值碰撞处理</b>：码值形如 {@code TRC + batchNo + 四位随机后缀}（1000~9999，
     * 即单批次 9000 个可用值）。表语义是「一物一码」（V1__init_core.sql:266），
     * 一个采收批次按包装拆码时 900 个不够用（5000kg / 10kg 装就是 500 个，再拆箱就超），
     * 因此后缀取四位。随机后缀存在碰撞可能，因此生成后先按 code 查重，
     * 撞了就重新生成，最多 {@link #CODE_GENERATE_MAX_RETRY} 次；重试耗尽时抛
     * {@code TRACE_CODE_DUPLICATED} 并说明原因（不依赖唯一键冲突异常兜底，那会变成 500）。</p>
     *
     * @param batchId 采收批次业务 ID（如 {@code DEMO-BATCH-001}）或遗留数字批次 ID
     * @return 本次新生成的溯源码
     */
    @Transactional
    public String generate(String batchId) {
        String batchNo = resolveBatchNo(batchId);
        if (batchNo == null) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "无法解析出批次号（batch_no）：batchId=" + batchId);
        }

        // 必须在真实存在的采收批次上发码；查不到就明确拒绝，不写入任何行
        HarvestBatchEntity harvestBatch = harvestBatchMapper.selectOne(
                new LambdaQueryWrapper<HarvestBatchEntity>()
                        .eq(HarvestBatchEntity::getBatchNo, batchNo)
                        .last("LIMIT 1"));
        if (harvestBatch == null) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "采收批次不存在：batchId=" + batchId + "，batchNo=" + batchNo);
        }

        String code = generateUniqueCode(batchNo, batchId);

        TraceCodeEntity traceCode = new TraceCodeEntity();
        // batch_id 留空：见本方法 Javadoc，V13 起该列可空，禁止合成数字填充
        traceCode.setBatchId(null);
        traceCode.setBatchNo(batchNo);
        traceCode.setCode(code);
        traceCode.setStatus("generated");
        traceCode.setScanCount(0);
        traceCodeMapper.insert(traceCode);
        return code;
    }

    /**
     * 生成一个未被占用的溯源码。
     *
     * <p>码值形如 {@code TRC + batchNo + 四位随机后缀}（{@code nextInt(1000, 9999)}）。
     * 随机后缀会碰撞，所以先按 {@code code} 查重再决定是否采用；
     * 连续碰撞到上限就明确报错，而不是把唯一键冲突抛成 500。</p>
     *
     * @param batchNo 批次号
     * @param batchId 原始入参，仅用于报错时定位
     * @return 未被占用的溯源码
     */
    private String generateUniqueCode(String batchNo, String batchId) {
        for (int attempt = 1; attempt <= CODE_GENERATE_MAX_RETRY; attempt += 1) {
            String candidate = "TRC" + batchNo + ThreadLocalRandom.current().nextInt(1000, 9999);
            Long used = traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCodeEntity>()
                    .eq(TraceCodeEntity::getCode, candidate));
            if (used == null || used == 0L) {
                return candidate;
            }
        }
        throw new BusinessException(
                ErrorCode.TRACE_CODE_DUPLICATED,
                "溯源码生成失败：连续 " + CODE_GENERATE_MAX_RETRY
                        + " 次码值碰撞（单批次可用值仅 9000 个），batchId=" + batchId
                        + "，batchNo=" + batchNo);
    }

    /**
     * 分页查询溯源码。
     *
     * @param page   页码
     * @param size   每页条数
     * @param status 状态过滤
     * @return 分页结果
     */
    public PageResult<TraceCodeEntity> page(long page, long size, String status) {
        Page<TraceCodeEntity> result = traceCodeMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TraceCodeEntity>()
                        .eq(status != null && !status.isBlank(), TraceCodeEntity::getStatus, status)
                        .orderByDesc(TraceCodeEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 按溯源码查询详情。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    public TraceCodeEntity detail(String code) {
        List<TraceCodeEntity> list = traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getCode, code)
                .last("LIMIT 1"));
        if (list.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return list.get(0);
    }

    /**
     * 激活溯源码：generated → active，并发布 prod.trace.activated。
     *
     * @param code        溯源码
     * @param activatedBy 激活人
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity activate(String code, String activatedBy) {
        TraceCodeEntity traceCode = detail(code);
        if ("revoked".equals(traceCode.getStatus())) {
            throw new BusinessException(ErrorCode.BIZ_ERROR);
        }
        traceCode.setStatus("active");
        traceCode.setActivatedAt(LocalDateTime.now());
        traceCode.setActivatedBy(activatedBy);
        traceCodeMapper.updateById(traceCode);

        eventPublisher.publish(ProduceEvents.PROD_TRACE_ACTIVATED, code,
                new ProduceEvents.TraceActivated(code, String.valueOf(traceCode.getBatchId()),
                        traceCode.getBatchNo(), activatedBy, traceCode.getMarketId(),
                        traceCode.getActivatedAt().toString()));
        return traceCode;
    }

    /**
     * 扫码：累计扫码次数并刷新最后扫码时间。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity scan(String code) {
        TraceCodeEntity traceCode = detail(code);
        traceCode.setScanCount(traceCode.getScanCount() == null ? 1 : traceCode.getScanCount() + 1);
        traceCode.setLastScanAt(LocalDateTime.now());
        if ("active".equals(traceCode.getStatus())) {
            traceCode.setStatus("scanned");
        }
        traceCodeMapper.updateById(traceCode);
        return traceCode;
    }

    /**
     * 作废溯源码（召回场景）。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity revoke(String code) {
        TraceCodeEntity traceCode = detail(code);
        traceCode.setStatus("revoked");
        traceCodeMapper.updateById(traceCode);
        return traceCode;
    }

    /**
     * 批次下的溯源码清单。
     *
     * <p>入参是<b>业务批次号语义的字符串</b>，不是数据库主键。原因见 {@link #resolveBatchNo(String)}：
     * 采收批次 ID 与溯源码的 batch_id 分处两个 ID 空间，只能靠 batch_no 对齐。</p>
     *
     * @param batchId 采收批次业务 ID（如 {@code DEMO-BATCH-001}）或遗留数字批次 ID
     * @return 溯源码列表；定位不到批次号时返回空列表
     */
    public List<TraceCodeEntity> listByBatch(String batchId) {
        String batchNo = resolveBatchNo(batchId);
        if (batchNo == null) {
            return new ArrayList<>();
        }
        return traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getBatchNo, batchNo)
                .orderByDesc(TraceCodeEntity::getCreatedAt));
    }

    /**
     * 把入参批次标识解析为可跨表对齐的 {@code batch_no}。
     *
     * <p><b>为什么需要这一步</b>：本模块存在两套互不相通的批次主键——
     * <ul>
     *   <li>{@code prod_harvest_batch.batch_id}：{@code varchar(32)}，形如 {@code DEMO-BATCH-001}；</li>
     *   <li>{@code prod_trace_code.batch_id}：{@code BIGINT}，形如 {@code 920000000000000001}。</li>
     * </ul>
     * 两者唯一稳定对齐的字段是 {@code batch_no}。直接拿同一个值去两张表查必然落空，
     * 早先把入参声明成 {@code Long} 更是让所有采收批次 ID 在类型转换阶段就失败。</p>
     *
     * <p>按置信度依次尝试：采收批次 ID → 采收批次号 → 遗留数字批次 ID → 溯源码表批次号。</p>
     *
     * @param batchId 批次标识（业务 ID / 批次号 / 遗留数字 ID 均可）
     * @return 对齐用的 {@code batch_no}；无法解析时返回 {@code null}
     */
    private String resolveBatchNo(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return null;
        }
        String input = batchId.trim();

        HarvestBatchEntity byBatchId = harvestBatchMapper.selectOne(
                new LambdaQueryWrapper<HarvestBatchEntity>()
                        .eq(HarvestBatchEntity::getBatchId, input)
                        .last("LIMIT 1"));
        if (byBatchId != null && byBatchId.getBatchNo() != null) {
            return byBatchId.getBatchNo();
        }

        HarvestBatchEntity byBatchNo = harvestBatchMapper.selectOne(
                new LambdaQueryWrapper<HarvestBatchEntity>()
                        .eq(HarvestBatchEntity::getBatchNo, input)
                        .last("LIMIT 1"));
        if (byBatchNo != null && byBatchNo.getBatchNo() != null) {
            return byBatchNo.getBatchNo();
        }

        Long legacyId = parseLongOrNull(input);
        if (legacyId != null) {
            List<TraceCodeEntity> byLegacy = traceCodeMapper.selectList(
                    new LambdaQueryWrapper<TraceCodeEntity>()
                            .eq(TraceCodeEntity::getBatchId, legacyId)
                            .last("LIMIT 1"));
            if (!byLegacy.isEmpty() && byLegacy.get(0).getBatchNo() != null) {
                return byLegacy.get(0).getBatchNo();
            }
        }

        List<TraceCodeEntity> byNo = traceCodeMapper.selectList(
                new LambdaQueryWrapper<TraceCodeEntity>()
                        .eq(TraceCodeEntity::getBatchNo, input)
                        .last("LIMIT 1"));
        if (!byNo.isEmpty() && byNo.get(0).getBatchNo() != null) {
            return byNo.get(0).getBatchNo();
        }
        return null;
    }

    /**
     * 安全解析长整数。
     *
     * @param value 待解析字符串
     * @return 解析结果；非数字或越界时返回 {@code null}
     */
    private Long parseLongOrNull(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 全链条节点：采收批次 → 溯源码 → 激活/扫码。
     *
     * <p>BATCH 节点取自 {@code prod_harvest_batch}（采收批次的权威表），不再取 V1 遗留的
     * {@code prod_batch}——那张表未参与播种，查出来恒为空，是此前「链路里没有 BATCH 节点」
     * 的直接原因。</p>
     *
     * @param batchId 采收批次业务 ID（如 {@code DEMO-BATCH-001}）或遗留数字批次 ID
     * @return 链路节点（先 BATCH 后 TRACE_CODE）；批次定位不到时返回空列表
     */
    public List<Map<String, Object>> fullChain(String batchId) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        String batchNo = resolveBatchNo(batchId);
        if (batchNo == null) {
            return nodes;
        }

        HarvestBatchEntity harvestBatch = harvestBatchMapper.selectOne(
                new LambdaQueryWrapper<HarvestBatchEntity>()
                        .eq(HarvestBatchEntity::getBatchId, batchId == null ? "" : batchId.trim())
                        .last("LIMIT 1"));
        if (harvestBatch == null) {
            harvestBatch = harvestBatchMapper.selectOne(
                    new LambdaQueryWrapper<HarvestBatchEntity>()
                            .eq(HarvestBatchEntity::getBatchNo, batchNo)
                            .last("LIMIT 1"));
        }
        if (harvestBatch != null) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "BATCH");
            node.put("nodeName", "采收批次");
            node.put("refId", harvestBatch.getBatchId());
            node.put("refNo", harvestBatch.getBatchNo());
            node.put("occurredAt", harvestBatch.getHarvestDate());
            nodes.add(node);
        }

        for (TraceCodeEntity code : traceCodeMapper.selectList(
                new LambdaQueryWrapper<TraceCodeEntity>()
                        .eq(TraceCodeEntity::getBatchNo, batchNo)
                        .orderByAsc(TraceCodeEntity::getCreatedAt))) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "TRACE_CODE");
            node.put("nodeName", "溯源码");
            node.put("refId", String.valueOf(code.getId()));
            node.put("refNo", code.getCode());
            node.put("occurredAt", code.getActivatedAt() == null ? code.getCreatedAt() : code.getActivatedAt());
            nodes.add(node);
        }
        return nodes;
    }
}
