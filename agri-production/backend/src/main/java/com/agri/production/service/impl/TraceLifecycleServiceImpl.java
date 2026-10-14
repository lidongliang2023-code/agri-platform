package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.entity.InventoryFlow;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.mapper.InventoryFlowMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.ITraceLifecycleService;
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
    private final IDomainEventService domainEventService;

    public TraceLifecycleServiceImpl(TraceCodeMapper traceCodeMapper, HarvestBatchMapper batchMapper,
                                    InspectionMapper inspectionMapper, InventoryFlowMapper inventoryFlowMapper,
                                    InputUsageRecordMapper inputUsageMapper,
                                    IDomainEventService domainEventService) {
        this.traceCodeMapper = traceCodeMapper;
        this.batchMapper = batchMapper;
        this.inspectionMapper = inspectionMapper;
        this.inventoryFlowMapper = inventoryFlowMapper;
        this.inputUsageMapper = inputUsageMapper;
        this.domainEventService = domainEventService;
    }

    @Override
    public PageResult<TraceCodeContractVO> page(int pageNum, int pageSize, String status, String tenantId) {
        LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<>();
        w.eq(TraceCode::getTenantId, tenantId);
        if (status != null && !status.isBlank()) {
            w.eq(TraceCode::getStatus, status.trim().toLowerCase());
        }
        w.orderByDesc(TraceCode::getId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<TraceCode> r = traceCodeMapper.selectPage(new Page<>(p, s), w);
        List<TraceCodeContractVO> list = new ArrayList<>();
        for (TraceCode c : r.getRecords()) {
            list.add(TraceCodeContractVO.of(c));
        }
        return PageResult.of(list, r.getTotal(), p, s);
    }

    @Override
    public TraceCodeContractVO detail(String code, String tenantId) {
        return TraceCodeContractVO.of(getOwned(code, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String generate(String batchId, String expireDate, String tenantId) {
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
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
        harvest.put("onChain", batch.getTraceCode() != null);
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
            node.put("onChain", Boolean.FALSE);
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
            node.put("onChain", Boolean.FALSE);
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
                node.put("onChain", Boolean.FALSE);
                nodes.add(node);
            }
        }

        // 5) 溯源码（该批次的码；有交易哈希才算已上链）
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
            node.put("txHash", code.getBlockchainTxHash());
            node.put("onChain", code.getBlockchainTxHash() != null && !code.getBlockchainTxHash().isBlank());
            nodes.add(node);
        }

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
            shaped.put("txHash", node.get("txHash"));
            shaped.put("onChain", node.get("onChain"));
            nodes.add(shaped);
            index += 1;
        }
        return nodes;
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
