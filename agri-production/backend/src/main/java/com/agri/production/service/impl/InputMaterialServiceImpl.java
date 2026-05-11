package com.agri.production.service.impl;

import com.agri.production.dto.InputMaterialPageDTO;
import com.agri.production.dto.InputMaterialSaveDTO;
import com.agri.production.entity.InputMaterial;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.InputMaterialMapper;
import com.agri.production.service.IInputMaterialService;
import com.agri.production.vo.InputMaterialVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class InputMaterialServiceImpl extends ServiceImpl<InputMaterialMapper, InputMaterial> implements IInputMaterialService {

    @Override
    @Transactional
    public InputMaterialVO save(InputMaterialSaveDTO dto, String tenantId) {
        InputMaterial material = BeanCopyUtils.copy(dto, InputMaterial.class);
        material.setTenantId(tenantId);
        material.setMaterialCode(generateMaterialCode(tenantId));
        material.setCurrentStock(dto.getInitialStock() != null ? dto.getInitialStock() : BigDecimal.ZERO);
        material.setStatus("active");
        save(material);
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    @Override
    @Transactional
    public InputMaterialVO update(InputMaterialSaveDTO dto, String tenantId) {
        InputMaterial material = getById(dto.getId());
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new RuntimeException("投入品不存在");
        }
        BeanCopyUtils.copy(dto, material);
        updateById(material);
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        InputMaterial material = getById(id);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new RuntimeException("投入品不存在");
        }
        if (material.getCurrentStock().compareTo(BigDecimal.ZERO) > 0) {
            throw new RuntimeException("投入品还有库存，无法删除");
        }
        removeById(id);
    }

    @Override
    public InputMaterialVO getById(Long id, String tenantId) {
        InputMaterial material = getById(id);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new RuntimeException("投入品不存在");
        }
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    @Override
    public PageResult<InputMaterialVO> pageQuery(InputMaterialPageDTO dto, String tenantId) {
        Page<InputMaterial> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<InputMaterial> result = baseMapper.pageQuery(page, dto, tenantId);
        List<InputMaterialVO> voList = BeanCopyUtils.copyList(result.getRecords(), InputMaterialVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public InputMaterialVO getByCode(String materialCode, String tenantId) {
        InputMaterial material = baseMapper.selectByCode(materialCode, tenantId);
        if (material == null) {
            throw new RuntimeException("投入品不存在");
        }
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    @Override
    @Transactional
    public InputMaterialVO stockIn(Long id, BigDecimal quantity, String batchNumber, String tenantId) {
        InputMaterial material = getById(id);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new RuntimeException("投入品不存在");
        }
        material.setCurrentStock(material.getCurrentStock().add(quantity));
        if (batchNumber != null && !batchNumber.isEmpty()) {
            material.setBatchNumber(batchNumber);
        }
        updateById(material);
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    @Override
    @Transactional
    public InputMaterialVO stockOut(Long id, BigDecimal quantity, String usageTaskId, String tenantId) {
        InputMaterial material = getById(id);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new RuntimeException("投入品不存在");
        }
        if (material.getCurrentStock().compareTo(quantity) < 0) {
            throw new RuntimeException("库存不足");
        }
        material.setCurrentStock(material.getCurrentStock().subtract(quantity));
        updateById(material);
        return BeanCopyUtils.copy(material, InputMaterialVO.class);
    }

    private String generateMaterialCode(String tenantId) {
        return "INP" + System.currentTimeMillis() % 1000000;
    }
}