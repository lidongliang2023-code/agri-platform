package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.QualityStandardSaveDTO;
import com.agri.masterdata.dto.QualityStandardUpdateDTO;
import com.agri.masterdata.entity.QualityStandard;
import com.agri.masterdata.mapper.QualityStandardMapper;
import com.agri.masterdata.service.IQualityStandardService;
import com.agri.masterdata.vo.QualityStandardVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QualityStandardServiceImpl implements IQualityStandardService {

    private final QualityStandardMapper qualityStandardMapper;

    @Override
    public PageResult<QualityStandardVO> page(Integer pageNum, Integer pageSize, String standardCode, String standardName) {
        Page<QualityStandard> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<QualityStandard> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(standardCode != null && !standardCode.isEmpty(), QualityStandard::getStandardCode, standardCode);
        wrapper.like(standardName != null && !standardName.isEmpty(), QualityStandard::getStandardName, standardName);
        wrapper.eq(QualityStandard::getDelFlag, 0);
        IPage<QualityStandard> result = qualityStandardMapper.selectPage(page, wrapper);
        return new PageResult<>(BeanCopyUtils.copyList(result.getRecords(), QualityStandardVO.class),
                result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public List<QualityStandardVO> listByCategoryId(Long categoryId) {
        List<QualityStandard> list = qualityStandardMapper.selectByCategoryId(categoryId);
        return BeanCopyUtils.copyList(list, QualityStandardVO.class);
    }

    @Override
    public QualityStandardVO getById(Long id) {
        QualityStandard standard = qualityStandardMapper.selectById(id);
        if (standard == null || standard.getDelFlag() == 1) {
            throw new BusinessException("质量标准不存在");
        }
        return BeanCopyUtils.copy(standard, QualityStandardVO.class);
    }

    @Override
    @Transactional
    public void save(QualityStandardSaveDTO dto) {
        QualityStandard standard = BeanCopyUtils.copy(dto, QualityStandard.class);
        standard.setTenantId(SecurityUtils.getTenantId());
        standard.setCreateBy(SecurityUtils.getUsername());
        standard.setDelFlag(0);
        qualityStandardMapper.insert(standard);
    }

    @Override
    @Transactional
    public void update(Long id, QualityStandardUpdateDTO dto) {
        QualityStandard standard = qualityStandardMapper.selectById(id);
        if (standard == null || standard.getDelFlag() == 1) {
            throw new BusinessException("质量标准不存在");
        }

        BeanCopyUtils.copyProperties(dto, standard);
        standard.setUpdateBy(SecurityUtils.getUsername());
        qualityStandardMapper.updateById(standard);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        QualityStandard standard = qualityStandardMapper.selectById(id);
        if (standard == null || standard.getDelFlag() == 1) {
            throw new BusinessException("质量标准不存在");
        }

        standard.setDelFlag(1);
        standard.setUpdateBy(SecurityUtils.getUsername());
        qualityStandardMapper.updateById(standard);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        QualityStandard standard = qualityStandardMapper.selectById(id);
        if (standard == null || standard.getDelFlag() == 1) {
            throw new BusinessException("质量标准不存在");
        }

        standard.setStatus(status);
        standard.setUpdateBy(SecurityUtils.getUsername());
        qualityStandardMapper.updateById(standard);
    }
}