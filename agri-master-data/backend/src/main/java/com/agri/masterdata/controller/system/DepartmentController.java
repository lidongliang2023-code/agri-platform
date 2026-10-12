package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.DeptSaveDTO;
import com.agri.masterdata.service.IDepartmentService;
import com.agri.masterdata.vo.DepartmentVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master-data")
@RequiredArgsConstructor
public class DepartmentController {

    private final IDepartmentService departmentService;

    @GetMapping("/orgs/{orgId}/depts")
    public ApiResponse<List<DepartmentVO>> listByOrgId(@PathVariable String orgId) {
        List<DepartmentVO> departments = departmentService.listByOrgId(orgId);
        return ApiResponse.success(departments);
    }

    @GetMapping("/orgs/{orgId}/depts/tree")
    public ApiResponse<List<DepartmentVO>> getDeptTree(@PathVariable String orgId) {
        List<DepartmentVO> tree = departmentService.getDeptTree(orgId);
        return ApiResponse.success(tree);
    }

    @GetMapping("/depts/{deptId}")
    public ApiResponse<DepartmentVO> getById(@PathVariable String deptId) {
        DepartmentVO department = departmentService.getById(deptId);
        return ApiResponse.success(department);
    }

    @PostMapping("/orgs/{orgId}/depts")
    public ApiResponse<Void> save(@PathVariable String orgId, @Valid @RequestBody DeptSaveDTO dto) {
        departmentService.save(orgId, dto);
        return ApiResponse.success();
    }

    @PutMapping("/depts/{deptId}")
    public ApiResponse<Void> update(@PathVariable String deptId, @Valid @RequestBody DeptSaveDTO dto) {
        departmentService.update(deptId, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/depts/{deptId}")
    public ApiResponse<Void> delete(@PathVariable String deptId) {
        departmentService.delete(deptId);
        return ApiResponse.success();
    }
}