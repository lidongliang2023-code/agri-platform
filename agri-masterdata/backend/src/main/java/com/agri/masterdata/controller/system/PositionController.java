package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.PositionSaveDTO;
import com.agri.masterdata.service.IPositionService;
import com.agri.masterdata.vo.PositionVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master-data")
@RequiredArgsConstructor
public class PositionController {

    private final IPositionService positionService;

    @GetMapping("/orgs/{orgId}/positions")
    public ApiResponse<List<PositionVO>> listByOrgId(@PathVariable String orgId) {
        List<PositionVO> positions = positionService.listByOrgId(orgId);
        return ApiResponse.success(positions);
    }

    @GetMapping("/depts/{deptId}/positions")
    public ApiResponse<List<PositionVO>> listByDeptId(@PathVariable String deptId) {
        List<PositionVO> positions = positionService.listByDeptId(deptId);
        return ApiResponse.success(positions);
    }

    @GetMapping("/positions/{positionId}")
    public ApiResponse<PositionVO> getById(@PathVariable String positionId) {
        PositionVO position = positionService.getById(positionId);
        return ApiResponse.success(position);
    }

    @PostMapping("/positions")
    public ApiResponse<Void> save(@Valid @RequestBody PositionSaveDTO dto) {
        positionService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/positions/{positionId}")
    public ApiResponse<Void> update(@PathVariable String positionId, @Valid @RequestBody PositionSaveDTO dto) {
        positionService.update(positionId, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/positions/{positionId}")
    public ApiResponse<Void> delete(@PathVariable String positionId) {
        positionService.delete(positionId);
        return ApiResponse.success();
    }
}