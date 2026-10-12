package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.entity.Dict;
import com.agri.masterdata.entity.DictItem;
import com.agri.masterdata.mapper.DictItemMapper;
import com.agri.masterdata.mapper.DictMapper;
import com.agri.masterdata.service.IDictService;
import com.agri.masterdata.vo.DictItemVO;
import com.agri.masterdata.vo.DictVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DictServiceImpl implements IDictService {

    private final DictMapper dictMapper;
    private final DictItemMapper dictItemMapper;

    @Override
    public List<DictVO> list() {
        String tenantId = SecurityUtils.getTenantId();
        return dictMapper.selectDictList(tenantId);
    }

    @Override
    public DictVO getById(Long id) {
        return dictMapper.selectDictById(id);
    }

    @Override
    @Transactional
    public void save(DictSaveDTO dto) {
        Dict existing = dictMapper.selectByDictCode(dto.getDictCode());
        if (existing != null) {
            throw new BusinessException("字典编码已存在");
        }

        Dict dict = BeanCopyUtils.copy(dto, Dict.class);
        dict.setTenantId(SecurityUtils.getTenantId());
        dict.setCreateBy(SecurityUtils.getUsername());
        dict.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        dict.setDelFlag(0);
        dictMapper.insert(dict);
    }

    @Override
    @Transactional
    public void update(Long id, DictSaveDTO dto) {
        Dict dict = dictMapper.selectById(id);
        if (dict == null || dict.getDelFlag() == 1) {
            throw new BusinessException("字典不存在");
        }

        BeanCopyUtils.copyProperties(dto, dict);
        dict.setUpdateBy(SecurityUtils.getUsername());
        dictMapper.updateById(dict);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Dict dict = dictMapper.selectById(id);
        if (dict == null || dict.getDelFlag() == 1) {
            throw new BusinessException("字典不存在");
        }

        dict.setDelFlag(1);
        dict.setUpdateBy(SecurityUtils.getUsername());
        dictMapper.updateById(dict);
        dictItemMapper.deleteByDictId(id);
    }

    @Override
    public List<DictItemVO> getItemsByDictId(Long dictId) {
        return dictItemMapper.selectDictItemsByDictId(dictId);
    }

    @Override
    public List<DictItemVO> getItemsByDictCode(String dictCode) {
        Dict dict = dictMapper.selectByDictCode(dictCode);
        if (dict == null) {
            return List.of();
        }
        return dictItemMapper.selectDictItemsByDictId(dict.getId());
    }

    @Override
    @Transactional
    public void saveItem(DictItemSaveDTO dto) {
        DictItem item = BeanCopyUtils.copy(dto, DictItem.class);
        item.setTenantId(SecurityUtils.getTenantId());
        item.setCreateBy(SecurityUtils.getUsername());
        item.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        item.setDelFlag(0);
        dictItemMapper.insert(item);
    }

    @Override
    @Transactional
    public void updateItem(Long id, DictItemSaveDTO dto) {
        DictItem item = dictItemMapper.selectById(id);
        if (item == null || item.getDelFlag() == 1) {
            throw new BusinessException("字典项不存在");
        }

        BeanCopyUtils.copyProperties(dto, item);
        item.setUpdateBy(SecurityUtils.getUsername());
        dictItemMapper.updateById(item);
    }

    @Override
    @Transactional
    public void deleteItem(Long id) {
        DictItem item = dictItemMapper.selectById(id);
        if (item == null || item.getDelFlag() == 1) {
            throw new BusinessException("字典项不存在");
        }

        item.setDelFlag(1);
        item.setUpdateBy(SecurityUtils.getUsername());
        dictItemMapper.updateById(item);
    }
}
