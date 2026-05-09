package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.LogisticsNodeSaveDTO;
import com.agri.masterdata.dto.LogisticsNodeUpdateDTO;
import com.agri.masterdata.vo.LogisticsNodeVO;

import java.util.List;

public interface ILogisticsNodeService {

    PageResult<LogisticsNodeVO> page(Integer pageNum, Integer pageSize, String nodeName, String nodeType);

    List<LogisticsNodeVO> listByRegionCode(String regionCode);

    List<LogisticsNodeVO> listByNodeType(String nodeType);

    LogisticsNodeVO getById(String nodeId);

    LogisticsNodeVO getByNodeCode(String nodeCode);

    void save(LogisticsNodeSaveDTO dto);

    void update(String nodeId, LogisticsNodeUpdateDTO dto);

    void delete(String nodeId);

    void changeStatus(String nodeId, String status);
}