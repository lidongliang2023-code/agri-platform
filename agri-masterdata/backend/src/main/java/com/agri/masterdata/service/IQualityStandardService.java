package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.QualityStandardSaveDTO;
import com.agri.masterdata.dto.QualityStandardUpdateDTO;
import com.agri.masterdata.vo.QualityStandardVO;

import java.util.List;

public interface IQualityStandardService {

    PageResult<QualityStandardVO> page(Integer pageNum, Integer pageSize, String standardCode, String standardName);

    List<QualityStandardVO> listByCategoryId(Long categoryId);

    QualityStandardVO getById(Long id);

    void save(QualityStandardSaveDTO dto);

    void update(Long id, QualityStandardUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);
}