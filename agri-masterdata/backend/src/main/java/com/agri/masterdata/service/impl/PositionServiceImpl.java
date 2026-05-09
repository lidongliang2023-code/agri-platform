package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.PositionSaveDTO;
import com.agri.masterdata.entity.Department;
import com.agri.masterdata.entity.Position;
import com.agri.masterdata.mapper.DepartmentMapper;
import com.agri.masterdata.mapper.PositionMapper;
import com.agri.masterdata.service.IPositionService;
import com.agri.masterdata.vo.PositionVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PositionServiceImpl implements IPositionService {

    private final PositionMapper positionMapper;
    private final DepartmentMapper departmentMapper;

    private static final Map<String, String> STATUS_MAP = Map.of(
            "active", "正常",
            "inactive", "停用"
    );

    @Override
    public List<PositionVO> listByDeptId(String deptId) {
        List<Position> positions = positionMapper.selectByDeptId(deptId);
        return positions.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public List<PositionVO> listByOrgId(String orgId) {
        List<Position> positions = positionMapper.selectByOrgId(orgId);
        return positions.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public PositionVO getById(String positionId) {
        Position position = positionMapper.selectById(positionId);
        if (position == null) {
            throw new BusinessException("岗位不存在");
        }
        return convertToVO(position);
    }

    @Override
    @Transactional
    public void save(PositionSaveDTO dto) {
        Department department = departmentMapper.selectById(dto.getDeptId());
        if (department == null) {
            throw new BusinessException("部门不存在");
        }

        LambdaQueryWrapper<Position> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Position::getDeptId, dto.getDeptId())
                .eq(Position::getPositionCode, dto.getPositionCode());
        if (positionMapper.exists(wrapper)) {
            throw new BusinessException("岗位编码已存在");
        }

        Position position = new Position();
        position.setPositionCode(dto.getPositionCode());
        position.setPositionName(dto.getPositionName());
        position.setDeptId(dto.getDeptId());
        position.setPositionLevel(dto.getPositionLevel());
        position.setPositionDesc(dto.getPositionDesc());
        position.setIncumbentCount(0);
        position.setStatus("active");

        positionMapper.insert(position);
    }

    @Override
    @Transactional
    public void update(String positionId, PositionSaveDTO dto) {
        Position position = positionMapper.selectById(positionId);
        if (position == null) {
            throw new BusinessException("岗位不存在");
        }

        if (!position.getDeptId().equals(dto.getDeptId())) {
            Department department = departmentMapper.selectById(dto.getDeptId());
            if (department == null) {
                throw new BusinessException("部门不存在");
            }
        }

        LambdaQueryWrapper<Position> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Position::getDeptId, dto.getDeptId())
                .eq(Position::getPositionCode, dto.getPositionCode())
                .ne(Position::getPositionId, positionId);
        if (positionMapper.exists(wrapper)) {
            throw new BusinessException("岗位编码已存在");
        }

        position.setPositionCode(dto.getPositionCode());
        position.setPositionName(dto.getPositionName());
        position.setDeptId(dto.getDeptId());
        position.setPositionLevel(dto.getPositionLevel());
        position.setPositionDesc(dto.getPositionDesc());

        positionMapper.updateById(position);
    }

    @Override
    @Transactional
    public void delete(String positionId) {
        Position position = positionMapper.selectById(positionId);
        if (position == null) {
            throw new BusinessException("岗位不存在");
        }

        positionMapper.deleteById(positionId);
    }

    private PositionVO convertToVO(Position entity) {
        PositionVO vo = new PositionVO();
        vo.setPositionId(entity.getPositionId());
        vo.setPositionCode(entity.getPositionCode());
        vo.setPositionName(entity.getPositionName());
        vo.setDeptId(entity.getDeptId());
        
        if (entity.getDeptId() != null) {
            Department dept = departmentMapper.selectById(entity.getDeptId());
            if (dept != null) {
                vo.setDeptName(dept.getDeptName());
            }
        }
        
        vo.setPositionLevel(entity.getPositionLevel());
        vo.setPositionDesc(entity.getPositionDesc());
        vo.setIncumbentCount(entity.getIncumbentCount());
        vo.setStatus(entity.getStatus());
        vo.setStatusName(STATUS_MAP.getOrDefault(entity.getStatus(), entity.getStatus()));
        vo.setCreateTime(entity.getCreateTime());
        return vo;
    }
}