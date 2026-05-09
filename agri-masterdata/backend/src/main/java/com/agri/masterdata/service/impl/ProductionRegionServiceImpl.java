package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.ProductionRegionSaveDTO;
import com.agri.masterdata.dto.ProductionRegionUpdateDTO;
import com.agri.masterdata.entity.ProductionRegion;
import com.agri.masterdata.mapper.ProductionRegionMapper;
import com.agri.masterdata.service.IProductionRegionService;
import com.agri.masterdata.vo.ProductionRegionVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductionRegionServiceImpl implements IProductionRegionService {

    private final ProductionRegionMapper productionRegionMapper;

    @Override
    public PageResult<ProductionRegionVO> page(Integer pageNum, Integer pageSize, String regionName, String regionType) {
        Page<ProductionRegion> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ProductionRegion> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(regionName != null && !regionName.isEmpty(), ProductionRegion::getRegionName, regionName);
        wrapper.eq(regionType != null && !regionType.isEmpty(), ProductionRegion::getRegionType, regionType);
        wrapper.eq(ProductionRegion::getDelFlag, 0);
        IPage<ProductionRegion> result = productionRegionMapper.selectPage(page, wrapper);
        return new PageResult<>(BeanCopyUtils.copyList(result.getRecords(), ProductionRegionVO.class),
                result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public List<ProductionRegionVO> listByParentCode(String parentCode) {
        List<ProductionRegion> list = productionRegionMapper.selectByParentCode(parentCode);
        return BeanCopyUtils.copyList(list, ProductionRegionVO.class);
    }

    @Override
    public List<ProductionRegionVO> listByRegionType(String regionType) {
        List<ProductionRegion> list = productionRegionMapper.selectByRegionType(regionType);
        return BeanCopyUtils.copyList(list, ProductionRegionVO.class);
    }

    @Override
    public List<ProductionRegionVO> listByProvince(String province) {
        List<ProductionRegion> list = productionRegionMapper.selectByProvince(province);
        return BeanCopyUtils.copyList(list, ProductionRegionVO.class);
    }

    @Override
    public ProductionRegionVO getById(Long id) {
        ProductionRegion region = productionRegionMapper.selectById(id);
        if (region == null || region.getDelFlag() == 1) {
            throw new BusinessException("产区不存在");
        }
        return BeanCopyUtils.copy(region, ProductionRegionVO.class);
    }

    @Override
    public ProductionRegionVO getByRegionCode(String regionCode) {
        ProductionRegion region = productionRegionMapper.selectByRegionCode(regionCode);
        if (region == null || region.getDelFlag() == 1) {
            return null;
        }
        return BeanCopyUtils.copy(region, ProductionRegionVO.class);
    }

    @Override
    @Transactional
    public void save(ProductionRegionSaveDTO dto) {
        ProductionRegion existing = productionRegionMapper.selectByRegionCode(dto.getRegionCode());
        if (existing != null) {
            throw new BusinessException("产区编码已存在");
        }

        ProductionRegion region = BeanCopyUtils.copy(dto, ProductionRegion.class);
        region.setTenantId(SecurityUtils.getTenantId());
        region.setCreateBy(SecurityUtils.getUsername());
        region.setDelFlag(0);
        productionRegionMapper.insert(region);
    }

    @Override
    @Transactional
    public void update(Long id, ProductionRegionUpdateDTO dto) {
        ProductionRegion region = productionRegionMapper.selectById(id);
        if (region == null || region.getDelFlag() == 1) {
            throw new BusinessException("产区不存在");
        }

        BeanCopyUtils.copyProperties(dto, region);
        region.setUpdateBy(SecurityUtils.getUsername());
        productionRegionMapper.updateById(region);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        ProductionRegion region = productionRegionMapper.selectById(id);
        if (region == null || region.getDelFlag() == 1) {
            throw new BusinessException("产区不存在");
        }

        region.setDelFlag(1);
        region.setUpdateBy(SecurityUtils.getUsername());
        productionRegionMapper.updateById(region);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        ProductionRegion region = productionRegionMapper.selectById(id);
        if (region == null || region.getDelFlag() == 1) {
            throw new BusinessException("产区不存在");
        }

        region.setStatus(status);
        region.setUpdateBy(SecurityUtils.getUsername());
        productionRegionMapper.updateById(region);
    }
}