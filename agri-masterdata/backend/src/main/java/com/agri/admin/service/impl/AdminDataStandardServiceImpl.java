package com.agri.admin.service.impl;

import com.agri.admin.dto.CodeRuleDTO;
import com.agri.admin.dto.DataFormatDTO;
import com.agri.admin.service.IAdminDataStandardService;
import com.agri.admin.vo.CodeRuleVO;
import com.agri.admin.vo.DataFormatVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.entity.Dict;
import com.agri.masterdata.entity.DictItem;
import com.agri.masterdata.mapper.DictItemMapper;
import com.agri.masterdata.mapper.DictMapper;
import com.agri.masterdata.vo.DictVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminDataStandardServiceImpl implements IAdminDataStandardService {

    private final DictMapper dictMapper;
    private final DictItemMapper dictItemMapper;

    @Override
    public PageResult<DictVO> getDictList(Integer pageNum, Integer pageSize, String dictName) {
        int offset = (pageNum - 1) * pageSize;
        List<DictVO> list = dictMapper.selectAdminDictList(offset, pageSize, dictName);
        long total = dictMapper.countAdminDictList(dictName);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public DictVO getDictDetail(Long id) {
        Dict dict = dictMapper.selectById(id);
        if (dict == null) {
            throw new BusinessException("字典不存在");
        }
        List<DictItem> items = dictItemMapper.selectByDictId(id);
        return DictVO.fromEntity(dict, items);
    }

    @Override
    @Transactional
    public void createDict(DictSaveDTO dto) {
        Dict dict = Dict.builder()
                .dictCode(dto.getDictCode())
                .dictName(dto.getDictName())
                .description(dto.getDescription())
                .build();
        dictMapper.insert(dict);
        
        if (dto.getItems() != null) {
            for (DictItemSaveDTO itemDto : dto.getItems()) {
                DictItem item = DictItem.builder()
                        .dictId(dict.getId())
                        .itemCode(itemDto.getItemCode())
                        .itemName(itemDto.getItemName())
                        .sortOrder(itemDto.getSortOrder())
                        .build();
                dictItemMapper.insert(item);
            }
        }
    }

    @Override
    @Transactional
    public void updateDict(Long id, DictSaveDTO dto) {
        Dict dict = dictMapper.selectById(id);
        if (dict == null) {
            throw new BusinessException("字典不存在");
        }
        dict.setDictName(dto.getDictName());
        dict.setDescription(dto.getDescription());
        dictMapper.updateById(dict);
    }

    @Override
    @Transactional
    public void deleteDict(Long id) {
        dictMapper.deleteById(id);
        dictItemMapper.deleteByDictId(id);
    }

    @Override
    @Transactional
    public void addDictItem(Long id, DictItemSaveDTO dto) {
        DictItem item = DictItem.builder()
                .dictId(id)
                .itemCode(dto.getItemCode())
                .itemName(dto.getItemName())
                .sortOrder(dto.getSortOrder())
                .build();
        dictItemMapper.insert(item);
    }

    @Override
    public List<CodeRuleVO> getCodeRuleList() {
        return new ArrayList<>();
    }

    @Override
    public CodeRuleVO getCodeRuleDetail(Long id) {
        return null;
    }

    @Override
    @Transactional
    public void createCodeRule(CodeRuleDTO dto) {
    }

    @Override
    @Transactional
    public void updateCodeRule(Long id, CodeRuleDTO dto) {
    }

    @Override
    @Transactional
    public void deleteCodeRule(Long id) {
    }

    @Override
    public String testCodeRule(Long id) {
        return "TEST001";
    }

    @Override
    public List<DataFormatVO> getDataFormatList() {
        return new ArrayList<>();
    }

    @Override
    @Transactional
    public void createDataFormat(DataFormatDTO dto) {
    }

    @Override
    public PageResult<DataFormatVO> getChangeApproveList(Integer pageNum, Integer pageSize, String status) {
        int offset = (pageNum - 1) * pageSize;
        List<DataFormatVO> list = new ArrayList<>();
        long total = 0;
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    @Transactional
    public void approveChange(Long id, String status, String remark) {
    }
}