package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.InputInfoSaveDTO;
import com.agri.production.dto.InputUsageSaveDTO;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.InputStockFlow;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.InputMaterialMapper;
import com.agri.production.mapper.InputStockFlowMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.IInputService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * 农资投入品。
 *
 * <p><b>库存只能从库存流水改动</b>：{@code stock_qty} 的每一次增减都紧跟着写一行流水，
 * 否则"流水加总 = 当前库存"这条对账关系立刻破掉，而破了之后谁也说不清差额是哪来的。</p>
 */
@Service
@Slf4j
public class InputServiceImpl implements IInputService {

    /** 入库方向的流水类型：入库 / 退回 / 盘盈 */
    private static final List<Integer> IN_TYPES = List.of(1, 3, 4);
    /** 出库方向的流水类型：领用 / 盘亏 / 报损 */
    private static final List<Integer> OUT_TYPES = List.of(2, 5, 6);

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter CODE_DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final InputMaterialMapper inputMapper;
    private final InputStockFlowMapper flowMapper;
    private final InputUsageRecordMapper usageMapper;
    private final PlotMapper plotMapper;

    public InputServiceImpl(InputMaterialMapper inputMapper,
                           InputStockFlowMapper flowMapper,
                           InputUsageRecordMapper usageMapper,
                           PlotMapper plotMapper) {
        this.inputMapper = inputMapper;
        this.flowMapper = flowMapper;
        this.usageMapper = usageMapper;
        this.plotMapper = plotMapper;
    }

    /* ==================== 投入品档案 ==================== */

    @Override
    public PageResult<InputMaterial> page(int pageNum, int pageSize, String keyword, Integer status,
                                         String inputType, String tenantId) {
        LambdaQueryWrapper<InputMaterial> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(InputMaterial::getTenantId, tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            wrapper.and(q -> q.like(InputMaterial::getInputName, kw).or().like(InputMaterial::getInputCode, kw));
        }
        if (status != null) {
            wrapper.eq(InputMaterial::getStatus, status);
        }
        if (inputType != null && !inputType.isBlank()) {
            wrapper.eq(InputMaterial::getInputType, inputType.trim());
        }
        wrapper.orderByDesc(InputMaterial::getCreateTime).orderByDesc(InputMaterial::getInputId);

        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<InputMaterial> result = inputMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        fillNearestExpire(result.getRecords(), tenantId);
        return PageResult.of(result.getRecords(), result.getTotal(), safePage, safeSize);
    }

    @Override
    public InputMaterial detail(Long inputId, String tenantId) {
        InputMaterial material = getOwned(inputId, tenantId);
        fillNearestExpire(List.of(material), tenantId);
        return material;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputMaterial create(InputInfoSaveDTO dto, String tenantId) {
        if (dto == null || dto.getInputName() == null || dto.getInputName().isBlank()) {
            throw new BusinessException(400, "投入品名称不能为空");
        }
        InputMaterial material = new InputMaterial();
        material.setTenantId(tenantId);
        material.setInputName(dto.getInputName().trim());
        material.setInputCode(trimToNull(dto.getInputCode()));
        if (material.getInputCode() == null) {
            material.setInputCode(nextInputCode(tenantId));
        }
        material.setInputType(trimToNull(dto.getInputType()));
        material.setSpec(trimToNull(dto.getSpec()));
        material.setUnit(trimToNull(dto.getUnit()));
        material.setManufacturer(trimToNull(dto.getManufacturer()));
        material.setRegistrationNo(trimToNull(dto.getRegistrationNo()));
        material.setSafetyInterval(dto.getSafetyInterval());
        material.setStockQty(dto.getStockQty() == null ? BigDecimal.ZERO : dto.getStockQty());
        material.setWarnQty(dto.getWarnQty());
        material.setSupplierId(toLong(dto.getSupplierId()));
        material.setStatus(dto.getStatus() == null ? 1 : dto.getStatus());
        material.setRemark(trimToNull(dto.getRemark()));
        material.setCreateTime(LocalDateTime.now());
        material.setUpdateTime(LocalDateTime.now());
        material.setDeleted(0);
        try {
            inputMapper.insert(material);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "投入品编码已存在（含已删除的档案）：" + material.getInputCode());
        }
        return material;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputMaterial update(Long inputId, InputInfoSaveDTO dto, String tenantId) {
        InputMaterial material = getOwned(inputId, tenantId);
        if (dto == null) {
            throw new BusinessException(400, "投入品内容不能为空");
        }
        if (dto.getInputName() != null && !dto.getInputName().isBlank()) {
            material.setInputName(dto.getInputName().trim());
        }
        if (dto.getInputCode() != null && !dto.getInputCode().isBlank()) {
            material.setInputCode(dto.getInputCode().trim());
        }
        if (dto.getInputType() != null) {
            material.setInputType(trimToNull(dto.getInputType()));
        }
        if (dto.getSpec() != null) {
            material.setSpec(trimToNull(dto.getSpec()));
        }
        if (dto.getUnit() != null) {
            material.setUnit(trimToNull(dto.getUnit()));
        }
        if (dto.getManufacturer() != null) {
            material.setManufacturer(trimToNull(dto.getManufacturer()));
        }
        if (dto.getRegistrationNo() != null) {
            material.setRegistrationNo(trimToNull(dto.getRegistrationNo()));
        }
        if (dto.getSafetyInterval() != null) {
            material.setSafetyInterval(dto.getSafetyInterval());
        }
        if (dto.getWarnQty() != null) {
            material.setWarnQty(dto.getWarnQty());
        }
        if (dto.getSupplierId() != null) {
            material.setSupplierId(toLong(dto.getSupplierId()));
        }
        if (dto.getStatus() != null) {
            material.setStatus(dto.getStatus());
        }
        if (dto.getRemark() != null) {
            material.setRemark(trimToNull(dto.getRemark()));
        }
        // 库存**不在这里改**：档案编辑放行库存字段会让"流水加总 = 库存"当场失守。
        // 期初库存只允许在建档时给一次；之后一律走入库 / 领用 / 盘点流水。
        if (dto.getStockQty() != null) {
            log.info("忽略档案编辑中的 stockQty={}（inputId={}）——库存只能由库存流水改动",
                    dto.getStockQty(), inputId);
        }
        material.setUpdateTime(LocalDateTime.now());
        try {
            inputMapper.updateById(material);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(400, "投入品编码已存在（含已删除的档案）：" + material.getInputCode());
        }
        return material;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long inputId, String tenantId) {
        getOwned(inputId, tenantId);
        inputMapper.deleteById(inputId);
    }

    @Override
    public List<InputMaterial> warningList(String tenantId) {
        List<InputMaterial> all = listAll(tenantId);
        List<InputMaterial> hit = all.stream()
                .filter(m -> m.getWarnQty() != null && m.getStockQty() != null
                        && m.getStockQty().compareTo(m.getWarnQty()) <= 0)
                .sorted(Comparator.comparing(InputMaterial::getStockQty))
                .collect(Collectors.toList());
        fillNearestExpire(hit, tenantId);
        return hit;
    }

    @Override
    public List<InputMaterial> stockOverview(String tenantId) {
        List<InputMaterial> all = listAll(tenantId);
        // 低库存优先：用"库存 − 阈值"排序（差值越小越缺），没配阈值的排最后
        all.sort(Comparator.comparing((InputMaterial m) ->
                m.getWarnQty() == null || m.getStockQty() == null
                        ? new BigDecimal("999999999")
                        : m.getStockQty().subtract(m.getWarnQty())));
        fillNearestExpire(all, tenantId);
        return all;
    }

    /* ==================== 库存流水 ==================== */

    @Override
    public PageResult<InputStockFlow> pageFlows(Long inputId, int pageNum, int pageSize, Integer flowType, String tenantId) {
        getOwned(inputId, tenantId);
        LambdaQueryWrapper<InputStockFlow> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(InputStockFlow::getTenantId, tenantId).eq(InputStockFlow::getInputId, inputId);
        if (flowType != null) {
            wrapper.eq(InputStockFlow::getFlowType, flowType);
        }
        wrapper.orderByDesc(InputStockFlow::getCreateTime).orderByDesc(InputStockFlow::getFlowId);
        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<InputStockFlow> result = flowMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), safePage, safeSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputStockFlow createFlow(Long inputId, InputStockFlow flow, String tenantId) {
        InputMaterial material = getOwned(inputId, tenantId);
        if (flow == null || flow.getFlowType() == null) {
            throw new BusinessException(400, "流水类型不能为空（1入库 2领用 3退回 4盘盈 5盘亏 6报损）");
        }
        if (flow.getQty() == null || flow.getQty().compareTo(BigDecimal.ZERO) == 0) {
            throw new BusinessException(400, "数量不能为空或 0");
        }
        BigDecimal signed = sign(flow.getFlowType(), flow.getQty());
        InputStockFlow saved = new InputStockFlow();
        saved.setInputId(inputId);
        saved.setWarehouseId(flow.getWarehouseId());
        saved.setFlowType(flow.getFlowType());
        saved.setQty(signed);
        saved.setBatchNo(trimToNull(flow.getBatchNo()));
        saved.setExpireDate(flow.getExpireDate());
        saved.setOperatorId(flow.getOperatorId());
        saved.setRelatedTaskId(flow.getRelatedTaskId());
        saved.setRemark(trimToNull(flow.getRemark()));
        saved.setTenantId(tenantId);
        saved.setCreateTime(LocalDateTime.now());
        saved.setUpdateTime(LocalDateTime.now());
        saved.setDeleted(0);
        flowMapper.insert(saved);
        applyStock(material, signed);
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteFlow(Long inputId, Long flowId, String tenantId) {
        getOwned(inputId, tenantId);
        InputStockFlow flow = flowMapper.selectById(flowId);
        if (flow == null || !inputId.equals(flow.getInputId()) || !tenantId.equals(flow.getTenantId())) {
            throw new BusinessException(404, "库存流水不存在：" + flowId);
        }
        // 删流水必须把库存回滚回去，否则删掉的只是记录、库存还停在错的位置
        InputMaterial material = getOwned(inputId, tenantId);
        applyStock(material, flow.getQty().negate());
        flowMapper.deleteById(flowId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputMaterial stockIn(Long inputId, BigDecimal qty, String batchNo, String expireDate,
                                 Long operatorId, String tenantId) {
        InputMaterial material = getOwned(inputId, tenantId);
        BigDecimal amount = requirePositive(qty);
        InputStockFlow flow = new InputStockFlow();
        flow.setFlowType(1);
        flow.setQty(amount);
        flow.setBatchNo(batchNo);
        flow.setExpireDate(parseDate(expireDate));
        flow.setOperatorId(operatorId);
        flow.setTenantId(tenantId);
        flow.setCreateTime(LocalDateTime.now());
        flow.setUpdateTime(LocalDateTime.now());
        flow.setDeleted(0);
        flow.setInputId(inputId);
        flowMapper.insert(flow);
        applyStock(material, amount);
        return detail(inputId, tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputMaterial consume(Long inputId, BigDecimal qty, Long relatedTaskId, Long operatorId, String tenantId) {
        InputMaterial material = getOwned(inputId, tenantId);
        BigDecimal amount = requirePositive(qty);
        InputStockFlow flow = new InputStockFlow();
        flow.setFlowType(2);
        flow.setQty(amount.negate());
        flow.setRelatedTaskId(relatedTaskId);
        flow.setOperatorId(operatorId);
        flow.setTenantId(tenantId);
        flow.setCreateTime(LocalDateTime.now());
        flow.setUpdateTime(LocalDateTime.now());
        flow.setDeleted(0);
        flow.setInputId(inputId);
        flowMapper.insert(flow);
        applyStock(material, amount.negate());
        return detail(inputId, tenantId);
    }

    /* ==================== 使用记录 ==================== */

    @Override
    public PageResult<InputUsageRecord> pageUsages(int pageNum, int pageSize, Integer status, Long inputId,
                                                   Long plotId, Long taskId, Long farmId, String tenantId) {
        LambdaQueryWrapper<InputUsageRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(InputUsageRecord::getTenantId, tenantId);
        if (status != null) {
            wrapper.eq(InputUsageRecord::getStatus, status);
        }
        if (inputId != null) {
            wrapper.eq(InputUsageRecord::getInputId, inputId);
        }
        if (plotId != null) {
            wrapper.eq(InputUsageRecord::getPlotId, plotId);
        }
        if (taskId != null) {
            wrapper.eq(InputUsageRecord::getTaskId, taskId);
        }
        if (farmId != null) {
            wrapper.eq(InputUsageRecord::getFarmId, farmId);
        }
        wrapper.orderByDesc(InputUsageRecord::getUsedAt).orderByDesc(InputUsageRecord::getUsageId);
        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        IPage<InputUsageRecord> result = usageMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), safePage, safeSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputUsageRecord createUsage(InputUsageSaveDTO dto, String tenantId) {
        if (dto == null) {
            throw new BusinessException(400, "使用记录不能为空");
        }
        // 两条必填：用的是什么（inputId 或 inputName）、用了多少（dosage）。
        // 少这两条校验时，一个空请求体就能在库里留下一条"什么都没记"的使用记录 ——
        // 列表上是一行空白，谁也说不清它是谁写的（实测：探测脚本发 POST {} 就造了一条）。
        if ((dto.getInputId() == null || dto.getInputId().isBlank())
                && (dto.getInputName() == null || dto.getInputName().isBlank())) {
            throw new BusinessException(400, "投入品不能为空（inputId 或 inputName 至少给一个）");
        }
        if (dto.getDosage() == null) {
            throw new BusinessException(400, "用量不能为空");
        }
        InputUsageRecord record = new InputUsageRecord();
        record.setTenantId(tenantId);
        applyUsage(record, dto);
        if (record.getUsedAt() == null) {
            record.setUsedAt(LocalDateTime.now());
        }
        if (record.getStatus() == null) {
            record.setStatus(1);
        }
        record.setCreateTime(LocalDateTime.now());
        record.setUpdateTime(LocalDateTime.now());
        record.setDeleted(0);
        usageMapper.insert(record);
        return record;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InputUsageRecord updateUsage(Long usageId, InputUsageSaveDTO dto, String tenantId) {
        InputUsageRecord record = usageMapper.selectById(usageId);
        if (record == null || !tenantId.equals(record.getTenantId())) {
            throw new BusinessException(404, "使用记录不存在：" + usageId);
        }
        applyUsage(record, dto);
        record.setUpdateTime(LocalDateTime.now());
        usageMapper.updateById(record);
        return record;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteUsage(Long usageId, String tenantId) {
        InputUsageRecord record = usageMapper.selectById(usageId);
        if (record == null || !tenantId.equals(record.getTenantId())) {
            throw new BusinessException(404, "使用记录不存在：" + usageId);
        }
        usageMapper.deleteById(usageId);
    }

    @Override
    public List<InputUsageRecord> usagesByTask(Long taskId, String tenantId) {
        return usageMapper.selectList(new LambdaQueryWrapper<InputUsageRecord>()
                .eq(InputUsageRecord::getTenantId, tenantId)
                .eq(InputUsageRecord::getTaskId, taskId)
                .orderByAsc(InputUsageRecord::getUsedAt));
    }

    /* ==================== 内部工具 ==================== */

    private List<InputMaterial> listAll(String tenantId) {
        return inputMapper.selectList(new LambdaQueryWrapper<InputMaterial>()
                .eq(InputMaterial::getTenantId, tenantId)
                .orderByAsc(InputMaterial::getInputId));
    }

    private InputMaterial getOwned(Long inputId, String tenantId) {
        InputMaterial material = inputMapper.selectById(inputId);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            // 越权与不存在都返 404：区分开等于告诉调用方"这条档案存在，只是不属于你"
            throw new BusinessException(404, "投入品不存在：" + inputId);
        }
        return material;
    }

    /** 把一条流水的数量按类型正负化（入库/退回/盘盈为正，领用/盘亏/报损为负）。 */
    private BigDecimal sign(Integer flowType, BigDecimal qty) {
        BigDecimal abs = qty.abs();
        if (IN_TYPES.contains(flowType)) {
            return abs;
        }
        if (OUT_TYPES.contains(flowType)) {
            return abs.negate();
        }
        throw new BusinessException(400, "未知的流水类型：" + flowType + "（1入库 2领用 3退回 4盘盈 5盘亏 6报损）");
    }

    /** 改库存并落库；扣成负数直接拒绝，而不是让库存出现负值。 */
    private void applyStock(InputMaterial material, BigDecimal delta) {
        BigDecimal current = material.getStockQty() == null ? BigDecimal.ZERO : material.getStockQty();
        BigDecimal next = current.add(delta);
        if (next.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(400, String.format("库存不足：当前 %s %s，本次需要 %s",
                    current.stripTrailingZeros().toPlainString(),
                    material.getUnit() == null ? "" : material.getUnit(),
                    delta.abs().stripTrailingZeros().toPlainString()));
        }
        material.setStockQty(next);
        material.setUpdateTime(LocalDateTime.now());
        inputMapper.updateById(material);
    }

    /**
     * 回填最近批次效期。
     *
     * <p>口径（契约里写明的三条）：优先取最早的**未过期**效期；全部过期时取最接近今天的那个；
     * 没有任何带效期的流水时为 null（页面显示"—"，不编日期）。</p>
     */
    private void fillNearestExpire(List<InputMaterial> list, String tenantId) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(InputMaterial::getInputId).filter(java.util.Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        List<InputStockFlow> flows = flowMapper.selectList(new LambdaQueryWrapper<InputStockFlow>()
                .eq(InputStockFlow::getTenantId, tenantId)
                .in(InputStockFlow::getInputId, ids)
                .isNotNull(InputStockFlow::getExpireDate)
                .orderByAsc(InputStockFlow::getExpireDate));
        Map<Long, List<LocalDate>> byInput = new HashMap<>();
        for (InputStockFlow flow : flows) {
            byInput.computeIfAbsent(flow.getInputId(), k -> new ArrayList<>()).add(flow.getExpireDate());
        }
        LocalDate today = LocalDate.now();
        for (InputMaterial material : list) {
            List<LocalDate> dates = byInput.get(material.getInputId());
            if (dates == null || dates.isEmpty()) {
                material.setNearestExpireDate(null);
                continue;
            }
            LocalDate pick = dates.stream().filter(d -> !d.isBefore(today)).findFirst()
                    .orElse(dates.get(dates.size() - 1));
            material.setNearestExpireDate(pick.format(DATE));
        }
    }

    private void applyUsage(InputUsageRecord record, InputUsageSaveDTO dto) {
        if (dto == null) {
            return;
        }
        if (dto.getTaskId() != null) {
            record.setTaskId(toLong(dto.getTaskId()));
        }
        if (dto.getPlotId() != null) {
            record.setPlotId(toLong(dto.getPlotId()));
        }
        if (dto.getInputId() != null) {
            record.setInputId(toLong(dto.getInputId()));
        }
        if (dto.getInputName() != null) {
            record.setInputName(trimToNull(dto.getInputName()));
        }
        // 投入品名称缺省时按 inputId 补全：列表页要显示"用了什么"，
        // 只存一个 ID 会让页面出现空列（且这是可推导的，不算编数据）
        if (record.getInputName() == null && record.getInputId() != null) {
            InputMaterial material = inputMapper.selectById(record.getInputId());
            if (material != null && record.getTenantId().equals(material.getTenantId())) {
                record.setInputName(material.getInputName());
                if (record.getUnit() == null) {
                    record.setUnit(material.getUnit());
                }
                if (record.getSafetyIntervalDays() == null) {
                    record.setSafetyIntervalDays(material.getSafetyInterval());
                }
            }
        }
        if (dto.getDosage() != null) {
            record.setDosage(dto.getDosage());
        }
        if (dto.getUnit() != null) {
            record.setUnit(trimToNull(dto.getUnit()));
        }
        if (dto.getMethod() != null) {
            record.setMethod(trimToNull(dto.getMethod()));
        }
        if (dto.getOperatorId() != null) {
            record.setOperatorId(toLong(dto.getOperatorId()));
        }
        if (dto.getUsedAt() != null && !dto.getUsedAt().isBlank()) {
            record.setUsedAt(parseDateTime(dto.getUsedAt()));
        }
        if (dto.getSafetyIntervalDays() != null) {
            record.setSafetyIntervalDays(dto.getSafetyIntervalDays());
        }
        if (dto.getStatus() != null) {
            record.setStatus(dto.getStatus());
        }
        if (dto.getRemark() != null) {
            record.setRemark(trimToNull(dto.getRemark()));
        }
        // farmId：契约里明说"新增时由服务端按 plotId 推导填充"
        Long farmId = toLong(dto.getFarmId());
        if (farmId != null) {
            record.setFarmId(farmId);
        } else if (record.getFarmId() == null && record.getPlotId() != null) {
            Plot plot = plotMapper.selectById(record.getPlotId());
            if (plot != null) {
                record.setFarmId(plot.getFarmId());
            }
        }
    }

    private String nextInputCode(String tenantId) {
        String day = LocalDate.now().format(CODE_DAY);
        for (int i = 0; i < 8; i++) {
            String code = "IN-" + day + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = inputMapper.selectCount(new LambdaQueryWrapper<InputMaterial>()
                    .eq(InputMaterial::getTenantId, tenantId)
                    .eq(InputMaterial::getInputCode, code));
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成投入品编码失败，请稍后重试");
    }

    private BigDecimal requirePositive(BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "数量必须大于 0");
        }
        return qty;
    }

    /** 日期解析：容忍 {@code yyyy-MM-dd}、{@code yyyy-MM-dd HH:mm:ss} 与 ISO 带 T 三种写法。 */
    private LocalDate parseDate(String value) {
        String text = trimToNull(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式不正确：" + value + "（应为 yyyy-MM-dd）");
        }
    }

    private LocalDateTime parseDateTime(String value) {
        String text = trimToNull(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(text.contains("T") ? text : text.replace(' ', 'T'));
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                throw new BusinessException(400, "时间格式不正确：" + value + "（应为 yyyy-MM-dd HH:mm:ss）");
            }
        }
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
}
