package com.agri.production.service.impl;

import com.agri.production.dto.TraceCodeGenerateDTO;
import com.agri.production.dto.TraceCodeQueryDTO;
import com.agri.production.entity.Harvest;
import com.agri.production.entity.TraceCode;
import com.agri.production.entity.TraceRecord;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.mapper.TraceRecordMapper;
import com.agri.production.service.ITraceCodeService;
import com.agri.production.vo.TraceCodeVO;
import com.agri.production.vo.TraceRecordVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class TraceCodeServiceImpl extends ServiceImpl<TraceCodeMapper, TraceCode> implements ITraceCodeService {

    private final TraceRecordMapper traceRecordMapper;

    public TraceCodeServiceImpl(TraceRecordMapper traceRecordMapper) {
        this.traceRecordMapper = traceRecordMapper;
    }

    @Override
    @Transactional
    public List<TraceCodeVO> generate(TraceCodeGenerateDTO dto, String tenantId) {
        List<TraceCodeVO> result = new ArrayList<>();
        
        Harvest harvest = new Harvest();
        harvest.setId(dto.getHarvestId());
        
        for (int i = 0; i < dto.getQuantity(); i++) {
            TraceCode traceCode = new TraceCode();
            traceCode.setTenantId(tenantId);
            traceCode.setTraceCode(generateUniqueTraceCode());
            traceCode.setHarvestId(dto.getHarvestId());
            traceCode.setBatchNumber(dto.getBatchNumber());
            traceCode.setProductName(dto.getProductName());
            traceCode.setProductCode(dto.getProductCode());
            traceCode.setStatus("inactive");
            traceCode.setQueryCount(0);
            save(traceCode);
            result.add(BeanCopyUtils.copy(traceCode, TraceCodeVO.class));
        }
        
        return result;
    }

    @Override
    @Transactional
    public TraceCodeVO activate(String traceCode, String tenantId) {
        TraceCode code = baseMapper.selectByTraceCode(traceCode);
        if (code == null || !tenantId.equals(code.getTenantId())) {
            throw new RuntimeException("溯源码不存在");
        }
        code.setStatus("active");
        code.setActivateTime(LocalDateTime.now());
        updateById(code);
        return buildTraceCodeVO(code);
    }

    @Override
    @Transactional
    public void deactivate(String traceCode, String tenantId) {
        TraceCode code = baseMapper.selectByTraceCode(traceCode);
        if (code == null || !tenantId.equals(code.getTenantId())) {
            throw new RuntimeException("溯源码不存在");
        }
        code.setStatus("inactive");
        updateById(code);
    }

    @Override
    public TraceCodeVO queryForConsumer(String traceCode) {
        TraceCode code = baseMapper.selectByTraceCode(traceCode);
        if (code == null) {
            throw new RuntimeException("溯源码不存在");
        }
        
        if ("inactive".equals(code.getStatus())) {
            throw new RuntimeException("溯源码尚未激活");
        }
        
        baseMapper.updateQueryCount(traceCode);
        
        if (code.getFirstQueryTime() == null) {
            code.setFirstQueryTime(LocalDateTime.now());
            updateById(code);
        }
        
        return buildTraceCodeVO(code);
    }

    @Override
    public TraceCodeVO getByTraceCode(String traceCode, String tenantId) {
        TraceCode code = baseMapper.selectByTraceCode(traceCode);
        if (code == null || !tenantId.equals(code.getTenantId())) {
            throw new RuntimeException("溯源码不存在");
        }
        return buildTraceCodeVO(code);
    }

    @Override
    public PageResult<TraceCodeVO> pageQuery(TraceCodeQueryDTO dto, String tenantId) {
        Page<TraceCode> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<TraceCode> result = baseMapper.pageQuery(page, dto, tenantId);
        List<TraceCodeVO> voList = result.getRecords().stream()
                .map(this::buildTraceCodeVO)
                .toList();
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public List<TraceCodeVO> listByHarvestId(Long harvestId, String tenantId) {
        List<TraceCode> codes = baseMapper.selectByHarvestId(harvestId, tenantId);
        return codes.stream()
                .map(this::buildTraceCodeVO)
                .toList();
    }

    private TraceCodeVO buildTraceCodeVO(TraceCode code) {
        TraceCodeVO vo = BeanCopyUtils.copy(code, TraceCodeVO.class);
        List<TraceRecord> records = traceRecordMapper.selectByTraceCode(code.getTraceCode());
        vo.setTraceRecords(BeanCopyUtils.copyList(records, TraceRecordVO.class));
        return vo;
    }

    private String generateUniqueTraceCode() {
        String prefix = "AG";
        String timestamp = String.valueOf(System.currentTimeMillis());
        String random = String.format("%04d", (int)(Math.random() * 10000));
        return prefix + timestamp.substring(timestamp.length() - 8) + random;
    }
}