package com.agri.production.service.impl;

import com.agri.production.dto.HarvestPageDTO;
import com.agri.production.dto.HarvestSaveDTO;
import com.agri.production.entity.Harvest;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.HarvestMapper;
import com.agri.production.service.IHarvestService;
import com.agri.production.vo.HarvestVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class HarvestServiceImpl extends ServiceImpl<HarvestMapper, Harvest> implements IHarvestService {

    @Override
    @Transactional
    public HarvestVO save(HarvestSaveDTO dto, String tenantId) {
        Harvest harvest = BeanCopyUtils.copy(dto, Harvest.class);
        harvest.setTenantId(tenantId);
        harvest.setHarvestCode(generateHarvestCode(tenantId));
        harvest.setStatus("pending");
        if (harvest.getHarvestDate() == null) {
            harvest.setHarvestDate(java.time.LocalDate.now());
        }
        save(harvest);
        return BeanCopyUtils.copy(harvest, HarvestVO.class);
    }

    @Override
    @Transactional
    public HarvestVO update(HarvestSaveDTO dto, String tenantId) {
        Harvest harvest = getById(dto.getId());
        if (harvest == null || !tenantId.equals(harvest.getTenantId())) {
            throw new RuntimeException("采收记录不存在");
        }
        BeanCopyUtils.copy(dto, harvest);
        updateById(harvest);
        return BeanCopyUtils.copy(harvest, HarvestVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Harvest harvest = getById(id);
        if (harvest == null || !tenantId.equals(harvest.getTenantId())) {
            throw new RuntimeException("采收记录不存在");
        }
        removeById(id);
    }

    @Override
    public HarvestVO getById(Long id, String tenantId) {
        Harvest harvest = getById(id);
        if (harvest == null || !tenantId.equals(harvest.getTenantId())) {
            throw new RuntimeException("采收记录不存在");
        }
        return BeanCopyUtils.copy(harvest, HarvestVO.class);
    }

    @Override
    public PageResult<HarvestVO> pageQuery(HarvestPageDTO dto, String tenantId) {
        Page<Harvest> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Harvest> result = baseMapper.pageQuery(page, dto, tenantId);
        List<HarvestVO> voList = BeanCopyUtils.copyList(result.getRecords(), HarvestVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public List<HarvestVO> listByFarmId(Long farmId, String tenantId) {
        List<Harvest> harvests = baseMapper.selectByFarmId(farmId, tenantId);
        return BeanCopyUtils.copyList(harvests, HarvestVO.class);
    }

    @Override
    public HarvestVO getByCode(String harvestCode, String tenantId) {
        Harvest harvest = baseMapper.selectByCode(harvestCode, tenantId);
        if (harvest == null) {
            throw new RuntimeException("采收记录不存在");
        }
        return BeanCopyUtils.copy(harvest, HarvestVO.class);
    }

    @Override
    @Transactional
    public HarvestVO complete(Long id, java.math.BigDecimal actualQuantity, String qualityGrade, String tenantId) {
        Harvest harvest = getById(id);
        if (harvest == null || !tenantId.equals(harvest.getTenantId())) {
            throw new RuntimeException("采收记录不存在");
        }
        harvest.setActualQuantity(actualQuantity);
        harvest.setQualityGrade(qualityGrade);
        harvest.setStatus("completed");
        harvest.setTraceCode(generateTraceCode());
        updateById(harvest);
        return BeanCopyUtils.copy(harvest, HarvestVO.class);
    }

    private String generateHarvestCode(String tenantId) {
        return "HVT" + System.currentTimeMillis() % 1000000;
    }

    private String generateTraceCode() {
        return "TRC" + System.currentTimeMillis() + (int)(Math.random() * 10000);
    }
}