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
import com.agri.masterdata.entity.CodeRule;
import com.agri.masterdata.mapper.CodeRuleMapper;
import com.agri.masterdata.mapper.DictItemMapper;
import com.agri.masterdata.mapper.DictMapper;
import com.agri.masterdata.vo.DictVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminDataStandardServiceImpl implements IAdminDataStandardService {

    private final DictMapper dictMapper;
    private final DictItemMapper dictItemMapper;
    private final CodeRuleMapper codeRuleMapper;

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
        Dict dict = dictMapper.selectById(id);
        if (dict == null) {
            throw new BusinessException("字典不存在");
        }
        DictItem item = new DictItem();
        item.setDictId(id);
        // 表的 dict_code / item_code 两列是 NOT NULL 且无默认值（它们是从旧结构沿用下来的），
        // 页面表单里没有这两项，必须在这里补：dict_code 取自所属字典，item_code 缺省用 itemValue 兜底。
        // 少了这一步，新增字典项直接 500：Field 'dict_code' doesn't have a default value。
        item.setDictCode(dict.getDictCode());
        if (dto.getItemCode() == null || dto.getItemCode().isEmpty()) {
            item.setItemCode(dto.getItemValue());
        }
        // 原实现只写了 itemCode / itemName / sortOrder 三个字段，
        // 页面上填的"值"（itemValue）、排序（itemSort）、状态全部被丢掉 —— 存进去是空值。
        applyDictItemDto(item, dto);
        if (item.getStatus() == null) {
            item.setStatus(1);
        }
        item.setDelFlag(0);
        dictItemMapper.insert(item);
    }

    @Override
    @Transactional
    public void updateDictItem(Long itemId, DictItemSaveDTO dto) {
        DictItem item = dictItemMapper.selectById(itemId);
        if (item == null) {
            throw new BusinessException("字典项不存在");
        }
        applyDictItemDto(item, dto);
        dictItemMapper.updateById(item);
    }

    @Override
    @Transactional
    public void deleteDictItem(Long itemId) {
        DictItem item = dictItemMapper.selectById(itemId);
        if (item == null) {
            throw new BusinessException("字典项不存在");
        }
        // 走 del_flag 逻辑删除
        dictItemMapper.deleteById(itemId);
    }

    /** 字典项 DTO → 实体（新增与修改共用，避免两条路径映射的字段不一致） */
    private void applyDictItemDto(DictItem item, DictItemSaveDTO dto) {
        if (dto.getItemCode() != null) {
            item.setItemCode(dto.getItemCode());
        }
        if (dto.getItemName() != null) {
            item.setItemName(dto.getItemName());
        }
        if (dto.getItemText() != null) {
            item.setItemText(dto.getItemText());
        }
        if (dto.getItemValue() != null) {
            item.setItemValue(dto.getItemValue());
        }
        if (dto.getStatus() != null) {
            item.setStatus(dto.getStatus());
        }
        // 列表按 item_sort 排序，故两个排序字段都写，保持取值一致
        Integer sort = dto.getItemSort() != null ? dto.getItemSort() : dto.getSortOrder();
        if (sort != null) {
            item.setItemSort(sort);
            item.setSortOrder(sort);
        }
    }

    @Override
    public PageResult<CodeRuleVO> getCodeRuleList(Integer pageNum, Integer pageSize, String keyword, String status) {
        int offset = (pageNum - 1) * pageSize;

        // 列表与总数共用同一份条件：分两处写条件，只要漏改一处就会出现
        // "总数说 20 条、当页却是另一批数据"这种静默不一致。
        LambdaQueryWrapper<CodeRule> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(CodeRule::getRuleCode, keyword).or().like(CodeRule::getRuleName, keyword));
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(CodeRule::getStatus, Integer.valueOf(status));
        }
        wrapper.orderByAsc(CodeRule::getRuleCode);

        Long total = codeRuleMapper.selectCount(wrapper);
        wrapper.last("LIMIT " + offset + "," + pageSize);

        List<CodeRuleVO> list = new ArrayList<>();
        for (CodeRule rule : codeRuleMapper.selectList(wrapper)) {
            list.add(toCodeRuleVO(rule));
        }
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public CodeRuleVO getCodeRuleDetail(Long id) {
        CodeRule rule = codeRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("编码规则不存在");
        }
        return toCodeRuleVO(rule);
    }

    @Override
    @Transactional
    public void createCodeRule(CodeRuleDTO dto) {
        // 规则编码上有唯一索引。先查一次是为了给出可读的提示，
        // 而不是把数据库的 Duplicate entry 直接抛给用户。
        Long exists = codeRuleMapper.selectCount(
                new LambdaQueryWrapper<CodeRule>().eq(CodeRule::getRuleCode, dto.getRuleCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("规则编码已存在：" + dto.getRuleCode());
        }

        CodeRule rule = new CodeRule();
        // 规则编码是 NOT NULL 且有唯一索引：新增时必须显式写入，
        // 否则 MySQL 报 Field 'rule_code' doesn't have a default value（500）。
        rule.setRuleCode(dto.getRuleCode());
        applyDto(rule, dto);
        rule.setStatus(dto.getStatus() == null ? 1 : dto.getStatus());
        rule.setDelFlag(0);
        codeRuleMapper.insert(rule);
    }

    @Override
    @Transactional
    public void updateCodeRule(Long id, CodeRuleDTO dto) {
        CodeRule rule = codeRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("编码规则不存在");
        }

        // 只覆盖本次传了的字段：启用/禁用按钮只带一个 status，
        // 若在这里无脑 set 全部字段，会把规则名称、格式等一并清空。
        if (dto.getRuleCode() != null && !dto.getRuleCode().isEmpty() && !dto.getRuleCode().equals(rule.getRuleCode())) {
            Long exists = codeRuleMapper.selectCount(
                    new LambdaQueryWrapper<CodeRule>()
                            .eq(CodeRule::getRuleCode, dto.getRuleCode())
                            .ne(CodeRule::getId, id));
            if (exists != null && exists > 0) {
                throw new BusinessException("规则编码已存在：" + dto.getRuleCode());
            }
            rule.setRuleCode(dto.getRuleCode());
        }
        applyDto(rule, dto);
        if (dto.getStatus() != null) {
            rule.setStatus(dto.getStatus());
        }
        codeRuleMapper.updateById(rule);
    }

    @Override
    @Transactional
    public void deleteCodeRule(Long id) {
        CodeRule rule = codeRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("编码规则不存在");
        }
        // 走 del_flag（MyBatis-Plus 已配 logic-delete-field=delFlag）
        codeRuleMapper.deleteById(id);
    }

    @Override
    public String testCodeRule(Long id) {
        CodeRule rule = codeRuleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("编码规则不存在");
        }
        // 按规则真实拼一个样例，而不是返回写死的 TEST001 ——
        // "试算"的意义就在于把用户配的前缀/日期/序号长度拼出来给他看。
        StringBuilder code = new StringBuilder();
        if (rule.getPrefix() != null) {
            code.append(rule.getPrefix());
        }
        if (rule.getDateFormat() != null && !rule.getDateFormat().isEmpty()) {
            code.append(LocalDate.now().format(DateTimeFormatter.ofPattern(rule.getDateFormat())));
        }
        int seqLength = rule.getSeqLength() == null ? 4 : rule.getSeqLength();
        code.append(String.format("%0" + seqLength + "d", 1));
        if (rule.getSuffix() != null) {
            code.append(rule.getSuffix());
        }
        return code.toString();
    }

    /** DTO → 实体（只覆盖非空字段，用于新增与更新共用） */
    private void applyDto(CodeRule rule, CodeRuleDTO dto) {
        if (dto.getRuleName() != null) {
            rule.setRuleName(dto.getRuleName());
        }
        if (dto.getRuleType() != null) {
            rule.setRuleType(dto.getRuleType());
        }
        if (dto.getRulePattern() != null) {
            rule.setRulePattern(dto.getRulePattern());
        }
        if (dto.getDescription() != null) {
            rule.setDescription(dto.getDescription());
        }
        if (dto.getSeqLength() != null) {
            rule.setSeqLength(dto.getSeqLength());
        }
        if (dto.getDateFormat() != null) {
            rule.setDateFormat(dto.getDateFormat());
        }
        if (dto.getPrefix() != null) {
            rule.setPrefix(dto.getPrefix());
        }
        if (dto.getSuffix() != null) {
            rule.setSuffix(dto.getSuffix());
        }
    }

    private CodeRuleVO toCodeRuleVO(CodeRule rule) {
        CodeRuleVO vo = new CodeRuleVO();
        vo.setId(rule.getId());
        vo.setRuleCode(rule.getRuleCode());
        vo.setRuleName(rule.getRuleName());
        vo.setRuleType(rule.getRuleType());
        vo.setRulePattern(rule.getRulePattern());
        vo.setDescription(rule.getDescription());
        vo.setSeqLength(rule.getSeqLength());
        vo.setDateFormat(rule.getDateFormat());
        vo.setPrefix(rule.getPrefix());
        vo.setSuffix(rule.getSuffix());
        vo.setStatus(rule.getStatus());
        vo.setCreateTime(rule.getCreateTime() == null ? null : rule.getCreateTime().toString());
        vo.setUpdateTime(rule.getUpdateTime() == null ? null : rule.getUpdateTime().toString());
        return vo;
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
