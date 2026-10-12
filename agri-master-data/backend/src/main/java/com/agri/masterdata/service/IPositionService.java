package com.agri.masterdata.service;

import com.agri.masterdata.dto.PositionSaveDTO;
import com.agri.masterdata.vo.PositionVO;

import java.util.List;

public interface IPositionService {

    List<PositionVO> listByDeptId(String deptId);

    List<PositionVO> listByOrgId(String orgId);

    PositionVO getById(String positionId);

    void save(PositionSaveDTO dto);

    void update(String positionId, PositionSaveDTO dto);

    void delete(String positionId);
}