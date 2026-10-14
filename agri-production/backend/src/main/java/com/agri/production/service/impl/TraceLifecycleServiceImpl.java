package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.ITraceLifecycleService;
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
import java.util.List;
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

    public TraceLifecycleServiceImpl(TraceCodeMapper traceCodeMapper, HarvestBatchMapper batchMapper) {
        this.traceCodeMapper = traceCodeMapper;
        this.batchMapper = batchMapper;
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
