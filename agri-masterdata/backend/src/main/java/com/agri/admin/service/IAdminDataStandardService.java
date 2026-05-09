package com.agri.admin.service;

import com.agri.admin.dto.CodeRuleDTO;
import com.agri.admin.dto.DataFormatDTO;
import com.agri.admin.vo.CodeRuleVO;
import com.agri.admin.vo.DataFormatVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.vo.DictVO;

import java.util.List;

public interface IAdminDataStandardService {

    PageResult<DictVO> getDictList(Integer pageNum, Integer pageSize, String dictName);

    DictVO getDictDetail(Long id);

    void createDict(DictSaveDTO dto);

    void updateDict(Long id, DictSaveDTO dto);

    void deleteDict(Long id);

    void addDictItem(Long id, DictItemSaveDTO dto);

    List<CodeRuleVO> getCodeRuleList();

    CodeRuleVO getCodeRuleDetail(Long id);

    void createCodeRule(CodeRuleDTO dto);

    void updateCodeRule(Long id, CodeRuleDTO dto);

    void deleteCodeRule(Long id);

    String testCodeRule(Long id);

    List<DataFormatVO> getDataFormatList();

    void createDataFormat(DataFormatDTO dto);

    PageResult<DataFormatVO> getChangeApproveList(Integer pageNum, Integer pageSize, String status);

    void approveChange(Long id, String status, String remark);
}