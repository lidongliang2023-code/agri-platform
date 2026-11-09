package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.ProcessSaveDTO;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.ProcessRecord;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.ProcessRecordMapper;
import com.agri.production.vo.ProcessVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 加工记录（{@code /api/v1/production/process}）。
 *
 * <p>这一层是「加工」环节的唯一归属：词表、批次归属校验、单号生成都只在这里，
 * 溯源链路（{@link TraceLifecycleServiceImpl#fullChainNodes}）与页面读的是同一批记录，
 * 不存在"页面自己拼一段加工文案"的第二个真源。</p>
 *
 * <p>批次归属一律按调用方令牌解析出的经营主体判定：批次不是你的就 404（不是 403）——
 * 与存证写入、地块品种同一口径，避免用状态码差别泄露"这个批次存在但属于别人"。</p>
 */
@Slf4j
@Service
public class ProcessServiceImpl {

    /** 加工类型词表（封闭集合：不在表里的直接拒绝，不接受自由填写）。 */
    private static final Set<String> PROCESS_TYPES = Set.of(
            "PRECOOL", "SORTING", "GRADING", "DRYING", "PACKAGING", "CUTING");

    private static final Map<String, String> TYPE_LABELS = Map.of(
            "PRECOOL", "预冷",
            "SORTING", "分选清洗",
            "GRADING", "分级",
            "DRYING", "烘干",
            "PACKAGING", "分装",
            "CUTING", "净切");

    private static final Set<String> STATUS_VALUES = Set.of("DOING", "DONE", "CANCELED");

    private static final DateTimeFormatter CODE_DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final ProcessRecordMapper processMapper;
    private final HarvestBatchMapper batchMapper;

    public ProcessServiceImpl(ProcessRecordMapper processMapper, HarvestBatchMapper batchMapper) {
        this.processMapper = processMapper;
        this.batchMapper = batchMapper;
    }

    /** 加工类型的中文名（出参里由 {@link ProcessVO#getProcessTypeName()} 调用，页面不再各自翻译）。 */
    public static String typeLabel(String type) {
        String text = type == null ? null : type.trim().toUpperCase();
        return text == null ? null : TYPE_LABELS.get(text);
    }

    /** 某个批次的全部加工工序（按开始时间，未填时间的排在最前，稳定按 id）。 */
    public List<ProcessVO> listByBatch(String tenantId, String batchKey) {
        HarvestBatch batch = requireBatch(batchKey, tenantId);
        return ProcessVO.listOf(processMapper.selectList(new LambdaQueryWrapper<ProcessRecord>()
                .eq(ProcessRecord::getTenantId, tenantId)
                .eq(ProcessRecord::getBatchId, batch.getBatchId())
                .orderByAsc(ProcessRecord::getStartedAt)
                .orderByAsc(ProcessRecord::getId)));
    }

    /** 本主体名下的加工记录分页（供「加工管理」列表页；批次号/类型/状态为可选条件）。 */
    public PageResult<ProcessVO> page(int pageNum, int pageSize,
                                      String batchNo, String type,
                                      String status, String tenantId) {
        LambdaQueryWrapper<ProcessRecord> w = new LambdaQueryWrapper<ProcessRecord>()
                .eq(ProcessRecord::getTenantId, tenantId);
        if (notBlank(batchNo)) {
            w.eq(ProcessRecord::getBatchNo, batchNo.trim());
        }
        if (notBlank(type)) {
            w.eq(ProcessRecord::getProcessType, requireType(type));
        }
        if (notBlank(status)) {
            w.eq(ProcessRecord::getStatus, requireStatus(status));
        }
        w.orderByDesc(ProcessRecord::getStartedAt).orderByDesc(ProcessRecord::getId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<ProcessRecord> r = processMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(ProcessVO.listOf(r.getRecords()), r.getTotal(), p, s);
    }

    /** 登记一道加工工序。 */
    @Transactional(rollbackFor = Exception.class)
    public ProcessVO create(String tenantId, ProcessSaveDTO dto) {
        HarvestBatch batch = requireBatch(dto.getBatchId(), tenantId);
        ProcessRecord entity = new ProcessRecord();
        entity.setTenantId(tenantId);
        entity.setFarmId(batch.getFarmId());
        entity.setBatchId(batch.getBatchId());
        entity.setBatchNo(batch.getBatchNo());
        entity.setProcessCode(nextCode(tenantId));
        entity.setStatus("DONE");
        apply(entity, dto);
        processMapper.insert(entity);
        log.info("加工工序登记：{} 批次 {} / {}（{}）", entity.getProcessCode(),
                entity.getBatchNo(), entity.getProcessType(), entity.getId());
        return ProcessVO.of(entity);
    }

    /** 编辑加工工序（整表单保存，可选字段清空要真的清掉）。 */
    @Transactional(rollbackFor = Exception.class)
    public ProcessVO update(String tenantId, Long id, ProcessSaveDTO dto) {
        ProcessRecord entity = getOwned(tenantId, id);
        HarvestBatch batch = requireBatch(dto.getBatchId(), tenantId);
        entity.setBatchId(batch.getBatchId());
        entity.setBatchNo(batch.getBatchNo());
        entity.setFarmId(batch.getFarmId());
        apply(entity, dto);
        processMapper.updateById(entity);
        return ProcessVO.of(entity);
    }

    /** 删除加工工序（逻辑删除）。 */
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, Long id) {
        ProcessRecord entity = getOwned(tenantId, id);
        processMapper.deleteById(id);
        log.info("加工工序删除：{}（{}，租户 {}）", entity.getProcessCode(), id, tenantId);
    }

    /** 词表校验后的可存证业务键（供链路/存证侧复用）。 */
    public List<ProcessRecord> recordsOf(String tenantId, Long batchId) {
        return processMapper.selectList(new LambdaQueryWrapper<ProcessRecord>()
                .eq(ProcessRecord::getTenantId, tenantId)
                .eq(ProcessRecord::getBatchId, batchId)
                .orderByAsc(ProcessRecord::getStartedAt)
                .orderByAsc(ProcessRecord::getId));
    }

    private ProcessRecord getOwned(String tenantId, Long id) {
        ProcessRecord entity = processMapper.selectOne(new LambdaQueryWrapper<ProcessRecord>()
                .eq(ProcessRecord::getTenantId, tenantId)
                .eq(ProcessRecord::getId, id)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "加工记录不存在：" + id);
        }
        return entity;
    }

    /** 批次主键或批次号都认，归属不对/不存在都 404。 */
    private HarvestBatch requireBatch(String raw, String tenantId) {
        String text = raw == null ? null : raw.trim();
        if (text == null || text.isEmpty()) {
            throw new BusinessException(400, "采收批次不能为空");
        }
        Long pk = parseLong(text);
        HarvestBatch batch = pk == null ? null : batchMapper.selectById(pk);
        if (batch == null) {
            batch = batchMapper.selectOne(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getTenantId, tenantId)
                    .eq(HarvestBatch::getBatchNo, text)
                    .last("LIMIT 1"));
        }
        if (batch == null || !tenantId.equals(batch.getTenantId())) {
            throw new BusinessException(404, "采收批次不存在：" + text);
        }
        return batch;
    }

    private void apply(ProcessRecord entity, ProcessSaveDTO dto) {
        entity.setProcessType(requireType(dto.getProcessType()));
        entity.setProcessName(trim(dto.getProcessName()));
        entity.setLocation(trim(dto.getLocation()));
        entity.setOperatorName(trim(dto.getOperatorName()));
        entity.setStartedAt(dto.getStartedAt());
        entity.setFinishedAt(dto.getFinishedAt());
        if (dto.getStartedAt() != null && dto.getFinishedAt() != null
                && dto.getFinishedAt().isBefore(dto.getStartedAt())) {
            throw new BusinessException(400, "结束时间不能早于开始时间");
        }
        entity.setInputQuantity(requireNonNegative(dto.getInputQuantity(), "投入量"));
        entity.setOutputQuantity(requireNonNegative(dto.getOutputQuantity(), "产出量"));
        entity.setInputUnit(trim(dto.getInputUnit()));
        entity.setOutputUnit(trim(dto.getOutputUnit()));
        entity.setProcessParams(trim(dto.getProcessParams()));
        entity.setPhotos(trim(dto.getPhotos()));
        entity.setStatus(dto.getStatus() == null ? entity.getStatus() : requireStatus(dto.getStatus()));
        if (entity.getStatus() == null) {
            entity.setStatus("DONE");
        }
        entity.setRemark(trim(dto.getRemark()));
        entity.setUpdateTime(LocalDateTime.now());
    }

    private static BigDecimal requireNonNegative(BigDecimal value, String field) {
        if (value != null && value.signum() < 0) {
            throw new BusinessException(400, field + "不能为负数：" + value.toPlainString());
        }
        return value;
    }

    private static String requireType(String value) {
        String text = value == null ? null : value.trim().toUpperCase();
        if (text == null || !PROCESS_TYPES.contains(text)) {
            throw new BusinessException(400, "加工类型取值应为 PRECOOL / SORTING / GRADING / DRYING / "
                    + "PACKAGING / CUTING：" + value);
        }
        return text;
    }

    private static String requireStatus(String value) {
        String text = value == null ? null : value.trim().toUpperCase();
        if (text == null || !STATUS_VALUES.contains(text)) {
            throw new BusinessException(400, "状态取值应为 DOING / DONE / CANCELED：" + value);
        }
        return text;
    }

    /** 单号：PR + 当天日期 + 4 位随机，租户内查重（软删的历史单号不复用检查，见类注释）。 */
    private String nextCode(String tenantId) {
        String day = LocalDate.now().format(CODE_DAY);
        for (int i = 0; i < 10; i++) {
            String code = "PR" + day + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            Long used = processMapper.selectCount(new LambdaQueryWrapper<ProcessRecord>()
                    .eq(ProcessRecord::getTenantId, tenantId)
                    .eq(ProcessRecord::getProcessCode, code));
            if (used == null || used == 0) {
                return code;
            }
        }
        throw new BusinessException(500, "生成加工单号失败，请稍后重试");
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private static Long parseLong(String text) {
        if (!text.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
