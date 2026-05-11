package com.agri.production.service.impl;

import com.agri.production.dto.FarmPageDTO;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.entity.Farm;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.service.IFarmService;
import com.agri.production.vo.FarmVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FarmServiceImpl extends ServiceImpl<FarmMapper, Farm> implements IFarmService {

    @Override
    @Transactional
    public FarmVO save(FarmSaveDTO dto, String tenantId) {
        Farm farm = BeanCopyUtils.copy(dto, Farm.class);
        farm.setTenantId(tenantId);
        farm.setFarmCode(generateFarmCode(tenantId));
        farm.setStatus("active");
        farm.setAuditStatus("pending");
        save(farm);
        return BeanCopyUtils.copy(farm, FarmVO.class);
    }

    @Override
    @Transactional
    public FarmVO update(FarmSaveDTO dto, String tenantId) {
        Farm farm = getById(dto.getId());
        if (farm == null || !tenantId.equals(farm.getTenantId())) {
            throw new RuntimeException("农场不存在");
        }
        BeanCopyUtils.copy(dto, farm);
        updateById(farm);
        return BeanCopyUtils.copy(farm, FarmVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Farm farm = getById(id);
        if (farm == null || !tenantId.equals(farm.getTenantId())) {
            throw new RuntimeException("农场不存在");
        }
        removeById(id);
    }

    @Override
    public FarmVO getById(Long id, String tenantId) {
        Farm farm = getById(id);
        if (farm == null || !tenantId.equals(farm.getTenantId())) {
            throw new RuntimeException("农场不存在");
        }
        return BeanCopyUtils.copy(farm, FarmVO.class);
    }

    @Override
    public PageResult<FarmVO> pageQuery(FarmPageDTO dto, String tenantId) {
        Page<Farm> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Farm> result = baseMapper.pageQuery(page, dto, tenantId);
        List<FarmVO> voList = BeanCopyUtils.copyList(result.getRecords(), FarmVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public FarmVO getByCode(String farmCode, String tenantId) {
        Farm farm = baseMapper.selectByCode(farmCode, tenantId);
        if (farm == null) {
            throw new RuntimeException("农场不存在");
        }
        return BeanCopyUtils.copy(farm, FarmVO.class);
    }

    private String generateFarmCode(String tenantId) {
        return "FRM" + System.currentTimeMillis() % 1000000;
    }
}