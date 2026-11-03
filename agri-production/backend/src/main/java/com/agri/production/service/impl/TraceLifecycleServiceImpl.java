package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.ChainRecord;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.entity.InventoryFlow;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.ChainRecordMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.mapper.InventoryFlowMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.ChainEvidenceRule;
import com.agri.production.service.IChainRecordService;
import com.agri.production.service.ITraceLifecycleService;
import com.agri.production.service.TraceCodeFilter;
import com.agri.production.service.IDomainEventService;
import com.agri.production.vo.TraceCodeContractVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 溯源码生命周期。
 *
 * <p>状态机（与契约词表一致）：generated → active → scanned，任一步都可 → revoked / expired。
 * 存量 {@code inactive} 视同 generated（由 VO 归一化，这里也按 generated 处理）。</p>
 */
@Service
@Slf4j
public class TraceLifecycleServiceImpl implements ITraceLifecycleService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final TraceCodeMapper traceCodeMapper;
    private final HarvestBatchMapper batchMapper;
    private final InspectionMapper inspectionMapper;
    private final InventoryFlowMapper inventoryFlowMapper;
    private final InputUsageRecordMapper inputUsageMapper;
    private final ChainRecordMapper chainRecordMapper;
    private final IChainRecordService chainRecordService;
    private final IDomainEventService domainEventService;

    public TraceLifecycleServiceImpl(TraceCodeMapper traceCodeMapper, HarvestBatchMapper batchMapper,
                                    InspectionMapper inspectionMapper, InventoryFlowMapper inventoryFlowMapper,
                                    InputUsageRecordMapper inputUsageMapper,
                                    ChainRecordMapper chainRecordMapper,
                                    IChainRecordService chainRecordService,
                                    IDomainEventService domainEventService) {
        this.traceCodeMapper = traceCodeMapper;
        this.batchMapper = batchMapper;
        this.inspectionMapper = inspectionMapper;
        this.inventoryFlowMapper = inventoryFlowMapper;
        this.inputUsageMapper = inputUsageMapper;
        this.chainRecordMapper = chainRecordMapper;
        this.chainRecordService = chainRecordService;
        this.domainEventService = domainEventService;
    }

    @Override
    public PageResult<TraceCodeContractVO> page(int pageNum, int pageSize, TraceCodeFilter filter, String tenantId) {
        LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<>();
        w.eq(TraceCode::getTenantId, tenantId);
        filter.apply(w);
        w.orderByDesc(TraceCode::getId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<TraceCode> r = traceCodeMapper.selectPage(new Page<>(p, s), w);
        List<TraceCodeContractVO> list = new ArrayList<>();
        for (TraceCode c : r.getRecords()) {
            list.add(TraceCodeContractVO.of(c));
        }
        applyEvidence(list, tenantId);
        return PageResult.of(list, r.getTotal(), p, s);
    }

    /**
     * 给一批出参贴链上凭证（整页一次 IN 查询，不做 N+1）。
     *
     * <p>这一步是本轮的核心修正：列表的 {@code onChain} 以前读溯源码表那个从来没人写的
     * {@code blockchain_tx_hash}，于是有真实 SUCCESS 存证的码也被显示成"未上链"。
     * 现在与全链路节点、公开核验共用 {@link ChainEvidenceRule}。</p>
     */
    private void applyEvidence(List<TraceCodeContractVO> rows, String tenantId) {
        if (rows.isEmpty()) {
            return;
        }
        List<String> codes = rows.stream().map(TraceCodeContractVO::getCode).filter(java.util.Objects::nonNull).toList();
        Map<String, ChainRecord> evidence = chainRecordService.traceEvidence(codes, tenantId);
        for (TraceCodeContractVO row : rows) {
            row.applyEvidence(row.getCode() == null ? null
                    : evidence.get(row.getCode().trim().toUpperCase()));
        }
    }

    @Override
    public TraceCodeContractVO detail(String code, String tenantId) {
        TraceCodeContractVO vo = TraceCodeContractVO.of(getOwned(code, tenantId));
        applyEvidence(List.of(vo), tenantId);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String generate(String batchId, String expireDate, String tenantId) {
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
        LocalDate expiry = parseExpireDate(expireDate);
        Long batch = toLong(batchId);
        HarvestBatch b = batch == null ? null : batchMapper.selectById(batch);
        if (b == null || !tenantId.equals(b.getTenantId())) {
            throw new BusinessException(404, "采收批次不存在：" + batchId);
        }
        TraceCode code = new TraceCode();
        code.setTenantId(tenantId);
        code.setTraceCode(nextCode(b));
        code.setHarvestId(b.getBatchId());
        code.setHarvestCode(b.getBatchNo());
        code.setBatchNumber(b.getBatchNo());
        code.setProductName(b.getCropName() == null ? null
                : b.getCropName() + "(" + (b.getGrade() == null ? "-" : b.getGrade()) + "级)");
        code.setFarmId(b.getFarmId());
        code.setFarmName(b.getFarmName());
        code.setPlotId(b.getPlotId());
        code.setPlotCode(b.getPlotName());
        code.setCropName(b.getCropName());
        code.setQualityGrade(b.getGrade());
        code.setHarvestDate(b.getHarvestDate());
        // 入参一直有、列也一直有，只是此前没人写：留空就是"未设置有效期"，不拿采收日+1年编一个
        code.setExpiryDate(expiry);
        code.setStatus("generated");
        code.setQueryCount(0);
        code.setCreateTime(LocalDateTime.now());
        code.setUpdateTime(LocalDateTime.now());
        code.setDeleted(0);
        traceCodeMapper.insert(code);
        // 契约注释说这里要发 prod.trace.generated / activated 事件：本服务没有事件总线，
        // 因此没有伪造（与批次、质检两处一并记在缺口里）。
        return code.getTraceCode();
    }

    /** 到期日入参：只认 {@code yyyy-MM-dd}；不填就是"未设置有效期"（不参与到期扫描）。 */
    private static LocalDate parseExpireDate(String expireDate) {
        if (expireDate == null || expireDate.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(expireDate.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new BusinessException(400, "有效期格式不对，要用 yyyy-MM-dd（收到：" + expireDate.trim() + "）");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TraceCodeContractVO activate(String code, String activatedBy, String tenantId) {
        TraceCode entity = getOwned(code, tenantId);
        String status = normalize(entity.getStatus());
        if ("revoked".equals(status)) {
            throw new BusinessException(400, "已作废的溯源码不能激活");
        }
        entity.setStatus("active");
        entity.setActivateTime(LocalDateTime.now());
        // activatedBy 在表上没有列：不落库也不回填（回显出参里为 null），不编造
        log.info("溯源码 {} 激活（操作人入参 {}，表无对应列，未落库）", code, activatedBy);
        entity.setUpdateTime(LocalDateTime.now());
        traceCodeMapper.updateById(entity);
        // 契约要求激活联动 prod.trace.activated；按拍板口径落 outbox（status=NEW），不谎报"已发送"。
        domainEventService.traceActivated(code,
                entity.getHarvestId() == null ? null : String.valueOf(entity.getHarvestId()),
                entity.getBatchNumber(),
                activatedBy,
                LocalDateTime.now().toString(),
                tenantId);
        return TraceCodeContractVO.of(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TraceCodeContractVO scan(String code, String tenantId) {
        TraceCode entity = getOwned(code, tenantId);
        entity.setQueryCount((entity.getQueryCount() == null ? 0 : entity.getQueryCount()) + 1);
        if (entity.getFirstQueryTime() == null) {
            entity.setFirstQueryTime(LocalDateTime.now());
        }
        String status = normalize(entity.getStatus());
        if ("active".equals(status) || "generated".equals(status)) {
            entity.setStatus("scanned");
        }
        entity.setUpdateTime(LocalDateTime.now());
        traceCodeMapper.updateById(entity);
        return TraceCodeContractVO.of(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TraceCodeContractVO revoke(String code, String tenantId) {
        TraceCode entity = getOwned(code, tenantId);
        entity.setStatus("revoked");
        entity.setUpdateTime(LocalDateTime.now());
        traceCodeMapper.updateById(entity);
        return TraceCodeContractVO.of(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int batchUpdateStatus(List<String> codes, String targetStatus, String tenantId) {
        if (codes == null || codes.isEmpty()) {
            throw new BusinessException(400, "codes 不能为空");
        }
        String target = normalize(targetStatus);
        int affected = 0;
        for (String code : codes) {
            TraceCode entity = find(code, tenantId);
            if (entity == null) {
                continue;
            }
            entity.setStatus(target);
            if ("active".equals(target) && entity.getActivateTime() == null) {
                entity.setActivateTime(LocalDateTime.now());
            }
            entity.setUpdateTime(LocalDateTime.now());
            traceCodeMapper.updateById(entity);
            affected += 1;
        }
        return affected;
    }

    /**
     * 到期扫描：把过了"有效期至"且还没走完生命周期的码置为 {@code expired}。
     *
     * <p>为什么需要它：生成接口一直收 {@code expireDate}，但既没落库也没有扫描，
     * 于是"有效期"只是页面上一个填了也没用的输入框。现在两件事都补上了。</p>
     *
     * <p>口径：只处理 {@code expiry_date < 今天} 且状态仍是 {@code generated/active/scanned}
     * （含存量写法 {@code inactive}）的码；已作废（revoked）与已过期的不动，
     * 没设有效期的码**不参与**（不拿采收日或创建日编一个到期日出来）。
     * 由定时任务（全部主体）与页面手动触发（仅本主体）共用。</p>
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int expireOverdue(String tenantId) {
        LocalDate today = LocalDate.now();
        LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<TraceCode>()
                .isNotNull(TraceCode::getExpiryDate)
                .lt(TraceCode::getExpiryDate, today)
                .in(TraceCode::getStatus, List.of("generated", "active", "scanned", "inactive"));
        if (tenantId != null && !tenantId.isBlank()) {
            w.eq(TraceCode::getTenantId, tenantId);
        }
        List<TraceCode> overdue = traceCodeMapper.selectList(w);
        for (TraceCode item : overdue) {
            item.setStatus("expired");
            item.setUpdateTime(LocalDateTime.now());
            traceCodeMapper.updateById(item);
        }
        if (!overdue.isEmpty()) {
            log.info("溯源码到期扫描：{} 条置为 expired（截止 {}，主体 {}）",
                    overdue.size(), today, tenantId == null || tenantId.isBlank() ? "全部" : tenantId);
        }
        return overdue.size();
    }

    @Override
    public List<TraceCodeContractVO> listByBatch(String batchId, String tenantId) {
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
        LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<>();
        w.eq(TraceCode::getTenantId, tenantId);
        Long batch = toLong(batchId);
        if (batch != null) {
            w.and(q -> q.eq(TraceCode::getHarvestId, batch).or().eq(TraceCode::getBatchNumber, batchId));
        } else {
            w.eq(TraceCode::getBatchNumber, batchId);
        }
        w.orderByDesc(TraceCode::getId);
        List<TraceCodeContractVO> list = new ArrayList<>();
        for (TraceCode c : traceCodeMapper.selectList(w)) {
            list.add(TraceCodeContractVO.of(c));
        }
        applyEvidence(list, tenantId);
        return list;
    }

    /* ==================== 全链路（派生聚合） ==================== */

    @Override
    public List<Map<String, Object>> fullChainNodes(String batchId, String tenantId) {
        HarvestBatch batch = requireBatch(batchId, tenantId);
        List<Map<String, Object>> nodes = new ArrayList<>();

        // 1) 采收
        Map<String, Object> harvest = new LinkedHashMap<>();
        harvest.put("nodeType", "harvest");
        harvest.put("nodeName", "采收");
        harvest.put("stage", "harvest");
        harvest.put("refId", batch.getBatchId());
        harvest.put("refNo", batch.getBatchNo());
        harvest.put("occurredAt", batch.getHarvestDate() == null ? null : batch.getHarvestDate().toString());
        harvest.put("operatorName", batch.getOperatorName());
        harvest.put("description", String.format("采收 %s %s，等级 %s",
                batch.getQuantity() == null ? "—" : batch.getQuantity().stripTrailingZeros().toPlainString(),
                batch.getUnit() == null ? "" : batch.getUnit(),
                batch.getGrade() == null ? "—" : batch.getGrade()));
        // 链上凭证不在这里逐节点猜：全部节点建完后统一交给 attachChainEvidence 按存证表判定
        nodes.add(harvest);

        // 2) 质检（按批次号或批次 id 关联；契约的检测单挂的是批次）
        for (Inspection ins : inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId)
                .and(q -> q.eq(Inspection::getBatchId, batch.getBatchId())
                        .or().eq(Inspection::getBatchNo, batch.getBatchNo())))) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "inspect");
            node.put("nodeName", "质量检测");
            node.put("stage", "inspect");
            node.put("refId", ins.getInspectionId());
            node.put("refNo", ins.getInspectionNo());
            node.put("occurredAt", ins.getSampleAt() == null ? null : ins.getSampleAt().toString());
            node.put("operatorName", ins.getInspectorName());
            node.put("description", String.format("%s，结论 %s，状态 %s",
                    ins.getInspectionType() == null ? "检测" : ins.getInspectionType(),
                    ins.getResult() == null ? "—" : ins.getResult(),
                    ins.getStatus() == null ? "—" : ins.getStatus()));
            nodes.add(node);
        }

        // 3) 入库 / 出库（该批次的库存流水）
        for (InventoryFlow flow : inventoryFlowMapper.selectList(new LambdaQueryWrapper<InventoryFlow>()
                .eq(InventoryFlow::getTenantId, tenantId)
                .eq(InventoryFlow::getBatchId, batch.getBatchId()))) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "storage");
            node.put("nodeName", flowTypeName(flow.getFlowType()));
            node.put("stage", "storage");
            node.put("refId", flow.getFlowId());
            node.put("refNo", flow.getWarehouseName());
            node.put("occurredAt", flow.getOperatedAt() == null ? null : flow.getOperatedAt().toString());
            node.put("operatorName", flow.getOperatorName());
            node.put("description", String.format("%s %s %s%s",
                    flowTypeName(flow.getFlowType()),
                    flow.getQuantity() == null ? "—" : flow.getQuantity().stripTrailingZeros().toPlainString(),
                    flow.getUnit() == null ? "" : flow.getUnit(),
                    flow.getRemark() == null ? "" : "（" + flow.getRemark() + "）"));
            nodes.add(node);
        }

        // 4) 投入品使用（按地块关联：这一批作物用过什么，直接决定溯源可信度）
        if (batch.getPlotId() != null) {
            for (InputUsageRecord usage : inputUsageMapper.selectList(new LambdaQueryWrapper<InputUsageRecord>()
                    .eq(InputUsageRecord::getTenantId, tenantId)
                    .eq(InputUsageRecord::getPlotId, batch.getPlotId()))) {
                Map<String, Object> node = new LinkedHashMap<>();
                node.put("nodeType", "input");
                node.put("nodeName", "投入品使用");
                node.put("stage", "input");
                node.put("refId", usage.getUsageId());
                node.put("refNo", usage.getInputName());
                node.put("occurredAt", usage.getUsedAt() == null ? null : usage.getUsedAt().toString());
                node.put("operatorName", usage.getOperatorId());
                node.put("description", String.format("使用 %s %s%s，方式 %s",
                        usage.getInputName() == null ? "—" : usage.getInputName(),
                        usage.getDosage() == null ? "—" : usage.getDosage().stripTrailingZeros().toPlainString(),
                        usage.getUnit() == null ? "" : usage.getUnit(),
                        usage.getMethod() == null ? "—" : usage.getMethod()));
                nodes.add(node);
            }
        }

        // 5) 溯源码（该批次的码；有没有上链看存证表，不看 blockchain_tx_hash 那个没人写的列）
        for (TraceCode code : traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCode>()
                .eq(TraceCode::getTenantId, tenantId)
                .and(q -> q.eq(TraceCode::getHarvestId, batch.getBatchId())
                        .or().eq(TraceCode::getBatchNumber, batch.getBatchNo())))) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "trace");
            node.put("nodeName", "溯源码");
            node.put("stage", "trace");
            node.put("refId", code.getId());
            node.put("refNo", code.getTraceCode());
            node.put("occurredAt", code.getActivateTime() == null ? null : code.getActivateTime().toString());
            node.put("operatorName", null);
            node.put("description", "溯源码状态 " + normalize(code.getStatus())
                    + "，查询 " + (code.getQueryCount() == null ? 0 : code.getQueryCount()) + " 次");
            nodes.add(node);
        }

        attachChainEvidence(tenantId, nodes);
        nodes.sort(Comparator.comparing(n -> String.valueOf(n.get("occurredAt") == null ? "" : n.get("occurredAt"))));
        return nodes;
    }

    @Override
    public List<Map<String, Object>> fullChainByCode(String code, String tenantId) {
        TraceCode entity = getOwned(code, tenantId);
        String batchKey = entity.getBatchNumber() != null ? entity.getBatchNumber()
                : (entity.getHarvestId() == null ? null : String.valueOf(entity.getHarvestId()));
        if (batchKey == null) {
            throw new BusinessException(400, "该溯源码没有关联批次，无法取全链路");
        }
        List<Map<String, Object>> raw = fullChainNodes(batchKey, tenantId);
        List<Map<String, Object>> nodes = new ArrayList<>();
        int index = 1;
        for (Map<String, Object> node : raw) {
            Map<String, Object> shaped = new LinkedHashMap<>();
            shaped.put("nodeId", node.get("nodeType") + "-" + (node.get("refId") == null ? index : node.get("refId")));
            shaped.put("batchId", entity.getHarvestId());
            shaped.put("stage", node.get("stage"));
            shaped.put("stageName", node.get("nodeName"));
            shaped.put("occurredAt", node.get("occurredAt"));
            shaped.put("operatorName", node.get("operatorName"));
            shaped.put("description", node.get("description"));
            shaped.put("refId", node.get("refId"));
            shaped.put("refNo", node.get("refNo"));
            shaped.put("attested", node.get("attested"));
            shaped.put("onChain", node.get("onChain"));
            shaped.put("chainStatus", node.get("chainStatus"));
            shaped.put("chainType", node.get("chainType"));
            shaped.put("recordNo", node.get("recordNo"));
            shaped.put("txHash", node.get("txHash"));
            shaped.put("blockNumber", node.get("blockNumber"));
            shaped.put("chainTime", node.get("chainTime"));
            shaped.put("failedReason", node.get("failedReason"));
            nodes.add(shaped);
            index += 1;
        }
        return nodes;
    }

    /**
     * 溯源核验视图（**跨主体**，供监管公众查询与移动端扫码使用）。
     *
     * <p><b>为什么允许跨主体</b>：溯源码存在的全部意义就是"任何人拿到这串码都能验真伪"。
     * 属主侧的 {@code /codes/{code}}、{@code /full-chain/**} 一律按令牌主体过滤，
     * 那是"我管理我的码"；核验是另一个语义 —— 监管与消费者手上只有码，没有生产主体的令牌。
     * 所以这条只回核验要用的字段（产品、批次、生产主体名、码状态、节点时间线与链上凭证），
     * 不回内部主键以外的经营数据。</p>
     *
     * <p><b>链上口径与属主视图完全同源</b>：节点的是否上链一律由
     * {@link #attachChainEvidence} 按 {@code agri_prod_chain_record} 的真实存证记录判定 ——
     * 有记录且 {@code chain_status=SUCCESS} 才算已上链，PENDING/FAILED 要如实说出来（含失败原因），
     * 没有记录就是"未存证"。属主侧 {@code /full-chain/**} 走的是同一个方法，
     * 两边不会出现"同一批次两个结论"。</p>
     *
     * <p>软删的码不参与核验：实体继承了 {@code BaseEntity} 的 {@code @TableLogic deleted}，
     * MyBatis-Plus 已给所有查询自动补 {@code deleted = 0}（2026-11-01 实测：属主列表与单码详情
     * 都取不到已删码），这里不再重复写条件，只保留"取不到就报不存在或已作废"的语义。</p>
     */
    @Override
    public Map<String, Object> publicVerification(String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(400, "缺少溯源码");
        }
        String key = code.trim();
        TraceCode entity = traceCodeMapper.selectOne(new LambdaQueryWrapper<TraceCode>()
                .eq(TraceCode::getTraceCode, key)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "溯源码不存在或已作废：" + key);
        }

        String batchKey = entity.getBatchNumber() != null ? entity.getBatchNumber()
                : (entity.getHarvestId() == null ? null : String.valueOf(entity.getHarvestId()));
        List<Map<String, Object>> rawNodes = batchKey == null
                ? new ArrayList<>() : fullChainNodes(batchKey, entity.getTenantId());

        List<Map<String, Object>> nodes = new ArrayList<>();
        int index = 1;
        for (Map<String, Object> node : rawNodes) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("seq", index);
            view.put("stage", node.get("stage"));
            view.put("stageName", node.get("nodeName"));
            view.put("title", nodeTitle(node));
            view.put("detail", node.get("description"));
            view.put("occurredAt", node.get("occurredAt"));
            view.put("operatorName", node.get("operatorName"));
            view.put("attested", node.get("attested"));
            view.put("onChain", node.get("onChain"));
            view.put("chainStatus", node.get("chainStatus"));
            view.put("chainType", node.get("chainType"));
            view.put("recordNo", node.get("recordNo"));
            view.put("txHash", node.get("txHash"));
            view.put("blockNumber", node.get("blockNumber"));
            view.put("chainTime", node.get("chainTime"));
            view.put("failedReason", node.get("failedReason"));
            nodes.add(view);
            index += 1;
        }

        ChainRecord self = codeAttestation(entity, key);
        long attestedCount = nodes.stream().filter(item -> Boolean.TRUE.equals(item.get("attested"))).count();
        long onChainCount = nodes.stream().filter(item -> Boolean.TRUE.equals(item.get("onChain"))).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("traceCode", entity.getTraceCode());
        result.put("productName", entity.getProductName());
        result.put("cropName", entity.getCropName());
        result.put("qualityGrade", entity.getQualityGrade());
        result.put("batchNo", entity.getBatchNumber());
        result.put("harvestDate", entity.getHarvestDate() == null ? null : entity.getHarvestDate().toString());
        result.put("farmName", entity.getFarmName());
        result.put("plotCode", entity.getPlotCode());
        result.put("tenantId", entity.getTenantId());
        result.put("status", entity.getStatus());
        // 到期判定不能只看 status：扫描是每小时跑一次，两次之间过了有效期的码
        // 状态还是 active —— 这时对公众说"可核验"就是假陈述，所以按日期再判一次。
        boolean expiredByDate = entity.getExpiryDate() != null
                && entity.getExpiryDate().isBefore(LocalDate.now());
        result.put("expiryDate", entity.getExpiryDate());
        result.put("expired", expiredByDate || "expired".equalsIgnoreCase(nullSafe(entity.getStatus())));
        result.put("verifiable", "active".equalsIgnoreCase(nullSafe(entity.getStatus())) && !expiredByDate);
        result.put("activatedAt", entity.getActivateTime() == null ? null
                : entity.getActivateTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        result.put("queryCount", entity.getQueryCount());
        result.put("codeTxHash", entity.getBlockchainTxHash());
        result.put("codeBlockHeight", entity.getBlockchainBlockHeight());
        result.put("selfAttestation", self == null ? null : Map.of(
                "recordNo", nullSafe(self.getRecordNo()),
                "chainStatus", nullSafe(self.getChainStatus()),
                "txHash", nullSafe(self.getTxHash()),
                "blockNumber", self.getBlockNumber() == null ? 0L : self.getBlockNumber()));
        result.put("nodes", nodes);
        result.put("nodeCount", nodes.size());
        result.put("attestedCount", attestedCount);
        result.put("onChainCount", onChainCount);
        result.put("chainConclusion", (expiredByDate
                ? "该溯源码有效期 " + entity.getExpiryDate() + " 已过，不再作为核验依据；" : "")
                + (nodes.isEmpty()
                ? "该码没有关联批次，取不到链路节点，无法核验"
                : onChainCount + "/" + nodes.size() + " 个节点已完成链上存证（状态 SUCCESS）"
                        + (attestedCount > onChainCount
                        ? "，另有 " + (attestedCount - onChainCount) + " 个节点存证未成功，请谨慎采信" : "")
                        + (attestedCount == 0 ? "，当前没有任何链上存证" : "")));
        return result;
    }

    /**
     * 给每个节点贴链上凭证（属主视图与核验视图唯一的一处判定）。
     *
     * <p>为什么要抽成一步：这三行曾经写成 {@code harvest.onChain = batch.traceCode != null}、
     * 其余节点一律 {@code false}、{@code txHash} 干脆没人填 —— 于是同一个批次，属主页说"采收已上链"
     * （其实是因为它挂了个码），核验页说"1/8 节点已上链、另 1 个存证未成功"，
     * 两个结论都自称来自系统，差在一句代理判断上。现在两个视图读同一份 {@code agri_prod_chain_record}。</p>
     *
     * <p>取数只按"可能有存证的节点"（采收/质检/溯源码）的业务键与主键收窄，
     * 投入品、出入库这类存证域没覆盖的业务不参与查询 —— 它们的真实结论是"没有存证记录"，
     * 而不是"查了但没命中"，所以 attested 一律 false，不硬凑。</p>
     */
    private void attachChainEvidence(String tenantId, List<Map<String, Object>> nodes) {
        List<String> targetCodes = new ArrayList<>();
        List<Long> targetIds = new ArrayList<>();
        for (Map<String, Object> node : nodes) {
            if (chainTargetType(node) == null) {
                continue;
            }
            String refNo = nullSafe(node.get("refNo"));
            if (!refNo.isEmpty() && !targetCodes.contains(refNo)) {
                targetCodes.add(refNo);
            }
            Long refId = asLong(node.get("refId"));
            if (refId != null && !targetIds.contains(refId)) {
                targetIds.add(refId);
            }
        }
        List<ChainRecord> records = new ArrayList<>();
        if (!targetCodes.isEmpty() || !targetIds.isEmpty()) {
            LambdaQueryWrapper<ChainRecord> wrapper = new LambdaQueryWrapper<ChainRecord>()
                    .eq(ChainRecord::getTenantId, tenantId)
                    .eq(ChainRecord::getDelFlag, 0);
            if (!targetCodes.isEmpty() && !targetIds.isEmpty()) {
                wrapper.and(q -> q.in(ChainRecord::getTargetCode, targetCodes)
                        .or().in(ChainRecord::getTargetId, targetIds));
            } else if (!targetCodes.isEmpty()) {
                wrapper.in(ChainRecord::getTargetCode, targetCodes);
            } else {
                wrapper.in(ChainRecord::getTargetId, targetIds);
            }
            wrapper.orderByAsc(ChainRecord::getId);
            records = chainRecordMapper.selectList(wrapper);
        }
        for (Map<String, Object> node : nodes) {
            ChainRecord record = matchRecord(node, records);
            node.put("attested", record != null);
            node.put("onChain", record != null && "SUCCESS".equalsIgnoreCase(nullSafe(record.getChainStatus())));
            node.put("chainStatus", record == null ? null : record.getChainStatus());
            node.put("chainType", record == null ? null : record.getChainType());
            node.put("recordNo", record == null ? null : record.getRecordNo());
            node.put("txHash", record == null ? null : record.getTxHash());
            node.put("blockNumber", record == null ? null : record.getBlockNumber());
            node.put("chainTime", record == null ? null : formatChainTime(record.getChainTime()));
            node.put("failedReason", record == null ? null : record.getFailedReason());
        }
    }

    /**
     * 这个码自身的存证（TRACE 类，按码值命中；码没关联批次时也能取到）。
     *
     * <p>选择规则与列表、节点视图完全一致（{@link ChainEvidenceRule#decide}）——
     * 以前这里"取最早一条"，于是同一个码先 FAILED 后重提成功时，核验视图会拿着历史的 FAILED
     * 说事，而列表说已上链。两处各自都有依据，正是最难查的那种分叉。</p>
     */
    private ChainRecord codeAttestation(TraceCode entity, String code) {
        List<ChainRecord> hits = chainRecordMapper.selectList(new LambdaQueryWrapper<ChainRecord>()
                .eq(ChainRecord::getTenantId, entity.getTenantId())
                .eq(ChainRecord::getDelFlag, 0)
                .apply("UPPER(target_type) = 'TRACE'")
                .eq(ChainRecord::getTargetCode, code)
                .orderByAsc(ChainRecord::getId));
        return ChainEvidenceRule.decide(hits);
    }

    /**
     * 节点 ↔ 存证记录匹配。
     *
     * <p>业务类型对齐表里的 {@code target_type}：采收→HARVEST、质检→QUALITY、溯源码→TRACE、
     * 投入品→INPUT；入库/出库没有存证环节，就是没上链，不硬凑。
     * 先按业务编号（target_code）对，再按主键（target_id）对 —— 与记录写入口径一致。</p>
     */
    /**
     * 节点 ↔ 存证记录匹配。
     *
     * <p>命中多条时（同一业务键反复提交存证）交给 {@link ChainEvidenceRule#decide} 选一条，
     * 与属主列表、运营端列表用的是<b>同一个规则</b> —— 否则"FAILED 后又提交成功"这种码，
     * 列表说已上链、链路说没上链，两边各自都有依据。</p>
     */
    private static ChainRecord matchRecord(Map<String, Object> node, List<ChainRecord> records) {
        String type = chainTargetType(node);
        if (type == null) {
            return null;
        }
        String refNo = nullSafe(node.get("refNo"));
        Long refId = asLong(node.get("refId"));
        List<ChainRecord> hits = records.stream()
                .filter(item -> type.equalsIgnoreCase(nullSafe(item.getTargetType())))
                .filter(item -> (!refNo.isEmpty() && refNo.equalsIgnoreCase(nullSafe(item.getTargetCode())))
                        || (refId != null && refId.equals(item.getTargetId())))
                .toList();
        return ChainEvidenceRule.decide(hits);
    }

    /**
     * 节点对应的存证业务类型；返回 {@code null} 表示存证表不覆盖这类业务。
     *
     * <p>词表与 {@code ChainRecordServiceImpl#normalizeType} 一致：采收→{@code HARVEST}、
     * 质检→{@code QUALITY}（前端旧词表叫 INSPECTION）、溯源码→{@code TRACE}、
     * 投入品使用→{@code INPUT}。入库/出库/种植在本部署没有存证环节，就是没上链，不硬凑。</p>
     *
     * <p>{@code INPUT} 是 2026-11-02 补上的：投入品页面一直在按数字 {@code bizType=2} 提交存证，
     * 落库成 {@code target_type='2'}，对号时对不到，于是这些节点被显示成"无存证记录"——
     * 明明存过证。数字词表下线、历史值迁移后，这里才第一次能把它认出来。</p>
     */
    private static String chainTargetType(Map<String, Object> node) {
        return switch (nullSafe(node.get("nodeType"))) {
            case "harvest" -> "HARVEST";
            case "inspect" -> "QUALITY";
            case "trace" -> "TRACE";
            case "input" -> "INPUT";
            default -> null;
        };
    }

    /** 上链时间统一成页面在用的 {@code yyyy-MM-dd HH:mm}（核验视图与属主视图同一个形状）。 */
    private static String formatChainTime(java.util.Date value) {
        return value == null ? null
                : new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(value);
    }

    /** 节点标题：阶段名 + 业务编号，页面上"采收 H20260601"这种可读形式。 */
    private static String nodeTitle(Map<String, Object> node) {
        String refNo = nullSafe(node.get("refNo"));
        String name = nullSafe(node.get("nodeName"));
        return refNo.isEmpty() ? name : name + " " + refNo;
    }

    private static String nullSafe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 取并校验批次（按 id 或按批次号都能定位，页面两边都在用）。 */
    private HarvestBatch requireBatch(String batchKey, String tenantId) {
        if (batchKey == null || batchKey.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
        Long id = toLong(batchKey);
        HarvestBatch batch = id == null ? null : batchMapper.selectById(id);
        if (batch == null) {
            batch = batchMapper.selectOne(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getTenantId, tenantId)
                    .eq(HarvestBatch::getBatchNo, batchKey.trim())
                    .last("LIMIT 1"));
        }
        if (batch == null || !tenantId.equals(batch.getTenantId())) {
            throw new BusinessException(404, "采收批次不存在：" + batchKey);
        }
        return batch;
    }

    private static String flowTypeName(Integer flowType) {
        if (flowType == null) {
            return "库存操作";
        }
        switch (flowType) {
            case 1:
                return "成品入库";
            case 2:
                return "成品出库";
            case 3:
                return "库存调拨";
            case 4:
                return "损耗登记";
            default:
                return "库存操作";
        }
    }

    /* ==================== 内部工具 ==================== */

    private TraceCode getOwned(String code, String tenantId) {
        TraceCode entity = find(code, tenantId);
        if (entity == null) {
            throw new BusinessException(404, "溯源码不存在：" + code);
        }
        return entity;
    }

    private TraceCode find(String code, String tenantId) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(400, "缺少溯源码");
        }
        return traceCodeMapper.selectOne(new LambdaQueryWrapper<TraceCode>()
                .eq(TraceCode::getTraceCode, code.trim())
                .eq(TraceCode::getTenantId, tenantId)
                .last("LIMIT 1"));
    }

    /** 生成码值：与演示码同构的 AG + 地块/农场两位 + 日期 + 4 位随机，保证同租户内唯一。 */
    private String nextCode(HarvestBatch batch) {
        String day = LocalDate.now().format(DAY);
        String plot = batch.getPlotId() == null ? "00" : String.format("%02d", batch.getPlotId());
        for (int i = 0; i < 10; i++) {
            String code = "AG" + plot + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCode>()
                    .eq(TraceCode::getTenantId, batch.getTenantId())
                    .eq(TraceCode::getTraceCode, code));
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成溯源码失败，请稍后重试");
    }

    private static String normalize(String status) {
        if (status == null || status.isBlank()) {
            return "generated";
        }
        String value = status.trim().toLowerCase();
        return "inactive".equals(value) ? "generated" : value;
    }

    private static Long toLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
