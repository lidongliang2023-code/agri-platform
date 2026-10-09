package com.agri.platform.internal.permission;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/roles")
@RequiredArgsConstructor
public class RoleAdminController {

    private final RoleMapper roleMapper;

    @GetMapping
    public ApiResponse<List<RoleEntity>> list() {
        return ApiResponse.ok(roleMapper.selectList(null));
    }
}
