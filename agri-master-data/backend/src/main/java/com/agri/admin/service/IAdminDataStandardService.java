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

    /**
     * 编码规则分页列表。
     *
     * <p>原签名是没有分页参数的 `List&lt;CodeRuleVO&gt; getCodeRuleList()`，
     * 而页面按分页结构消费（读 `data.list` / `data.total` 并渲染翻页控件）——
     * 接口返回裸数组时 `data.list` 恒为 undefined，页面永远空着。
     * 现与字典列表同一口径：分页 + 关键字 + 状态。</p>
     */
    PageResult<CodeRuleVO> getCodeRuleList(Integer pageNum, Integer pageSize, String keyword, String status);

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
