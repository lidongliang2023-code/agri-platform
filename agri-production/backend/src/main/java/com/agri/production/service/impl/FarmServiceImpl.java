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
        normalizePageAliases(dto);
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
        normalizePageAliases(dto);
        Farm farm = getById(dto.getId());
        if (farm == null || !tenantId.equals(farm.getTenantId())) {
            throw new RuntimeException("农场不存在");
        }
        BeanCopyUtils.copy(dto, farm);
        updateById(farm);
        return BeanCopyUtils.copy(farm, FarmVO.class);
    }

    /**
     * 把页面口径的字段名归一成实体列名（不归一就会被静默丢掉：页面提示保存成功、值却没存上）。
     *
     * <p>2026-10-16 实测：新建农场表单发 {@code areaTotal / managerName / managerPhone}，
     * 而实体列是 {@code total_area / manager_name / contact_phone} —— 详情页的面积、负责人、
     * 联系电话因此全是空的。{@code managerName} 与实体同名，由 BeanCopyUtils 直接落列（新增列）。</p>
     */
    private void normalizePageAliases(FarmSaveDTO dto) {
        if (dto == null) {
            return;
        }
        if (dto.getAreaTotal() != null && dto.getTotalArea() == null) {
            dto.setTotalArea(dto.getAreaTotal());
        }
        if (dto.getManagerPhone() != null && (dto.getContactPhone() == null || dto.getContactPhone().isBlank())) {
            dto.setContactPhone(dto.getManagerPhone());
        }
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
