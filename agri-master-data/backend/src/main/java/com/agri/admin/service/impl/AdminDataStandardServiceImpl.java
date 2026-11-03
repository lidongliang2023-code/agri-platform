package com.agri.admin.service.impl;

import com.agri.admin.dto.CodeRuleDTO;
import com.agri.admin.dto.DataFormatDTO;
import com.agri.admin.dto.MetadataDTO;
import com.agri.admin.dto.StandardChangeDTO;
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
import com.agri.masterdata.entity.DataFormat;
import com.agri.masterdata.entity.MetadataCatalog;
import com.agri.masterdata.entity.StandardChange;
import com.agri.masterdata.mapper.CodeRuleMapper;
import com.agri.masterdata.mapper.DataFormatMapper;
import com.agri.masterdata.mapper.DictItemMapper;
import com.agri.masterdata.mapper.DictMapper;
import com.agri.masterdata.mapper.MetadataCatalogMapper;
import com.agri.masterdata.mapper.StandardChangeMapper;
import com.agri.masterdata.vo.DictVO;
import com.agri.common.security.SecurityUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminDataStandardServiceImpl implements IAdminDataStandardService {

    private final DictMapper dictMapper;
    private final DictItemMapper dictItemMapper;
    private final CodeRuleMapper codeRuleMapper;
    private final DataFormatMapper dataFormatMapper;
    private final StandardChangeMapper changeMapper;
    private final MetadataCatalogMapper metadataMapper;

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
                .dictType(dto.getDictType())
                .description(dto.getDescription())
                // 表的 status 默认值是 0（禁用）：不显式写 1 的话，页面上点「新增字典」
                // 建出来的第一条就是"禁用"，看起来像新增失败
                .status(dto.getStatus() == null ? 1 : dto.getStatus())
                .delFlag(0)
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
        if (dto.getDictName() != null) dict.setDictName(dto.getDictName());
        if (dto.getDescription() != null) dict.setDescription(dto.getDescription());
        if (dto.getDictType() != null) dict.setDictType(dto.getDictType());
        // 原来不落 status：字典的启停按钮点了也不生效
        if (dto.getStatus() != null) dict.setStatus(dto.getStatus());
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
        // 手工录入规则没有前缀/序号，试算只会拼出一段无意义的字符；
        // 明确拒绝，而不是让 String.format 在 seqLength=0 时抛 500。
        if ("manual".equalsIgnoreCase(rule.getRuleType())) {
            throw new BusinessException("手工录入规则不参与自动生成，无需试算");
        }
        // 按规则真实拼一个样例，而不是返回写死的 TEST001 ——
        // "试算"的意义就在于把用户配的前缀/日期/序号长度拼出来给他看。
        StringBuilder code = new StringBuilder();
        if (rule.getPrefix() != null) {
            code.append(rule.getPrefix());
        }
        if (rule.getDateFormat() != null && !rule.getDateFormat().isEmpty()) {
            try {
                code.append(LocalDate.now().format(DateTimeFormatter.ofPattern(rule.getDateFormat())));
            } catch (IllegalArgumentException e) {
                throw new BusinessException("日期格式非法：" + rule.getDateFormat());
            }
        }
        // seqLength 可能是 0 或负数（历史数据里就有），%00d 会抛 IllegalFormatException
        int seqLength = rule.getSeqLength() == null || rule.getSeqLength() <= 0 ? 4 : rule.getSeqLength();
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
        List<DataFormat> rows = dataFormatMapper.selectList(
                new LambdaQueryWrapper<DataFormat>().orderByAsc(DataFormat::getFormatCode));
        List<DataFormatVO> list = new ArrayList<>();
        for (DataFormat row : rows) {
            list.add(toFormatVO(row));
        }
        return list;
    }

    @Override
    @Transactional
    public void createDataFormat(DataFormatDTO dto) {
        String code = trim(dto.getFormatCode());
        if (code == null) {
            throw new BusinessException("格式编码不能为空");
        }
        Long exists = dataFormatMapper.selectCount(new LambdaQueryWrapper<DataFormat>()
                .eq(DataFormat::getFormatCode, code));
        if (exists != null && exists > 0) {
            throw new BusinessException("格式编码已存在：" + code);
        }
        DataFormat entity = new DataFormat();
        entity.setFormatCode(code);
        entity.setFormatName(trim(dto.getFormatName()));
        entity.setDataType(dto.getDataType() == null ? "string" : dto.getDataType());
        entity.setValidationRule(dto.getValidationRule());
        entity.setMaxLength(dto.getMaxLength());
        entity.setMinLength(dto.getMinLength());
        entity.setDefaultValue(dto.getDefaultValue());
        entity.setDescription(dto.getDescription());
        // 新建先落草稿：发布是单独动作，避免"一建就对外生效"
        entity.setStatus("DRAFT");
        dataFormatMapper.insert(entity);
    }

    @Override
    @Transactional
    public void updateDataFormat(Long id, DataFormatDTO dto) {
        DataFormat entity = requireFormat(id);
        if (dto.getFormatName() != null) entity.setFormatName(trim(dto.getFormatName()));
        if (dto.getDataType() != null) entity.setDataType(dto.getDataType());
        if (dto.getValidationRule() != null) entity.setValidationRule(dto.getValidationRule());
        if (dto.getMaxLength() != null) entity.setMaxLength(dto.getMaxLength());
        if (dto.getMinLength() != null) entity.setMinLength(dto.getMinLength());
        if (dto.getDefaultValue() != null) entity.setDefaultValue(dto.getDefaultValue());
        if (dto.getDescription() != null) entity.setDescription(dto.getDescription());
        dataFormatMapper.updateById(entity);
    }

    @Override
    @Transactional
    public void updateDataFormatStatus(Long id, String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("DRAFT", "PUBLISHED", "DISABLED").contains(normalized)) {
            throw new BusinessException("状态只能是 DRAFT / PUBLISHED / DISABLED");
        }
        DataFormat entity = requireFormat(id);
        entity.setStatus(normalized);
        dataFormatMapper.updateById(entity);
    }

    @Override
    public PageResult<DataFormatVO> getChangeApproveList(Integer pageNum, Integer pageSize, String status) {
        LambdaQueryWrapper<StandardChange> wrapper = new LambdaQueryWrapper<StandardChange>()
                .eq(status != null && !status.isBlank(), StandardChange::getStatus, status)
                .orderByDesc(StandardChange::getApplyTime)
                .orderByDesc(StandardChange::getId);
        Page<StandardChange> page = changeMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<DataFormatVO> list = new ArrayList<>();
        for (StandardChange row : page.getRecords()) {
            DataFormatVO vo = new DataFormatVO();
            vo.setId(row.getId());
            vo.setFormatName(row.getTargetName());
            vo.setChangeType(row.getChangeType());
            vo.setStatus(row.getStatus());
            vo.setApplicant(row.getApplicant());
            vo.setApplyTime(row.getApplyTime() == null ? null : row.getApplyTime().toString());
            vo.setReviewTime(row.getReviewTime() == null ? null : row.getReviewTime().toString());
            vo.setRemark(row.getReviewRemark());
            vo.setDescription(row.getAfterValue());
            list.add(vo);
        }
        return PageResult.success(list, page.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public Long createStandardChange(StandardChangeDTO dto) {
        String targetType = trim(dto.getTargetType());
        if (targetType == null || !List.of("format", "dict", "code_rule").contains(targetType)) {
            throw new BusinessException("目标类型只能是 format / dict / code_rule");
        }
        String targetName = trim(dto.getTargetName());
        if (targetName == null) {
            throw new BusinessException("目标名称不能为空");
        }
        StandardChange entity = new StandardChange();
        entity.setTargetType(targetType);
        entity.setTargetId(trim(dto.getTargetId()));
        entity.setTargetName(targetName);
        entity.setChangeType(dto.getChangeType() == null ? "UPDATE" : dto.getChangeType().toUpperCase());
        entity.setBeforeValue(dto.getBeforeValue());
        entity.setAfterValue(dto.getAfterValue());
        entity.setStatus("PENDING");
        entity.setApplicant(SecurityUtils.getUsername());
        entity.setApplyTime(LocalDateTime.now());
        entity.setRemark(trim(dto.getRemark()));
        changeMapper.insert(entity);
        return entity.getId();
    }

    @Override
    @Transactional
    public void approveChange(Long id, String status, String remark) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("APPROVED", "REJECTED").contains(normalized)) {
            throw new BusinessException("审批状态只能是 APPROVED / REJECTED");
        }
        StandardChange entity = changeMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("变更申请不存在");
        }
        if (!"PENDING".equals(entity.getStatus())) {
            throw new BusinessException("该申请已审批，无需重复操作");
        }
        entity.setStatus(normalized);
        entity.setReviewer(SecurityUtils.getUsername());
        entity.setReviewTime(LocalDateTime.now());
        entity.setReviewRemark(remark);
        changeMapper.updateById(entity);
        // 明确不自动改写目标：审批只留痕，目标修改由申请人按审批意见再走一次编辑
    }

    @Override
    public List<MetadataCatalog> getMetadataList(String metadataType, String domain, String keyword) {
        return metadataMapper.selectList(new LambdaQueryWrapper<MetadataCatalog>()
                .eq(metadataType != null && !metadataType.isBlank(), MetadataCatalog::getMetadataType, metadataType)
                .eq(domain != null && !domain.isBlank(), MetadataCatalog::getDomainName, domain)
                .and(keyword != null && !keyword.isBlank(), w -> w
                        .like(MetadataCatalog::getName, keyword)
                        .or().like(MetadataCatalog::getNameEn, keyword))
                .orderByAsc(MetadataCatalog::getMetadataType)
                .orderByAsc(MetadataCatalog::getId));
    }

    @Override
    @Transactional
    public Long createMetadata(MetadataDTO dto) {
        String name = trim(dto.getName());
        if (name == null) {
            throw new BusinessException("中文名称不能为空");
        }
        String type = trim(dto.getMetadataType());
        if (type == null || !List.of("BUSINESS", "TECHNICAL", "MANAGEMENT").contains(type)) {
            throw new BusinessException("元数据类型只能是 BUSINESS / TECHNICAL / MANAGEMENT");
        }
        MetadataCatalog entity = new MetadataCatalog();
        applyMetadata(entity, dto, type, name);
        metadataMapper.insert(entity);
        return entity.getId();
    }

    @Override
    @Transactional
    public void updateMetadata(Long id, MetadataDTO dto) {
        MetadataCatalog entity = metadataMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("元数据不存在");
        }
        applyMetadata(entity, dto, trim(dto.getMetadataType()), trim(dto.getName()));
        metadataMapper.updateById(entity);
    }

    private void applyMetadata(MetadataCatalog entity, MetadataDTO dto, String type, String name) {
        if (type != null) entity.setMetadataType(type);
        if (name != null) entity.setName(name);
        if (dto.getNameEn() != null) entity.setNameEn(dto.getNameEn());
        if (dto.getDomainName() != null) entity.setDomainName(dto.getDomainName());
        if (dto.getDataType() != null) entity.setDataType(dto.getDataType());
        if (dto.getRequired() != null) entity.setRequired(dto.getRequired());
        if (dto.getSourceTable() != null) entity.setSourceTable(dto.getSourceTable());
        if (dto.getVersion() != null) entity.setVersion(dto.getVersion());
        if (dto.getDescription() != null) entity.setDescription(dto.getDescription());
        entity.setStatus(dto.getStatus() == null ? (entity.getStatus() == null ? "PUBLISHED" : entity.getStatus())
                : dto.getStatus().toUpperCase());
    }

    private DataFormat requireFormat(Long id) {
        DataFormat entity = dataFormatMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("格式标准不存在");
        }
        return entity;
    }

    private DataFormatVO toFormatVO(DataFormat row) {
        DataFormatVO vo = new DataFormatVO();
        vo.setId(row.getId());
        vo.setFormatCode(row.getFormatCode());
        vo.setFormatName(row.getFormatName());
        vo.setDataType(row.getDataType());
        vo.setValidationRule(row.getValidationRule());
        vo.setMaxLength(row.getMaxLength());
        vo.setMinLength(row.getMinLength());
        vo.setDefaultValue(row.getDefaultValue());
        vo.setDescription(row.getDescription());
        vo.setStatus(row.getStatus());
        return vo;
    }

    private static String trim(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
