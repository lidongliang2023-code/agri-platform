package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.UserIdentitySaveDTO;
import com.agri.masterdata.service.IUserIdentityService;
import com.agri.masterdata.vo.UserIdentityVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master-data/users/{userId}/identities")
@RequiredArgsConstructor
public class UserIdentityController {

    private final IUserIdentityService userIdentityService;

    @GetMapping
    public ApiResponse<List<UserIdentityVO>> list(@PathVariable String userId) {
        List<UserIdentityVO> identities = userIdentityService.listByUserId(userId);
        return ApiResponse.success(identities);
    }

    @GetMapping("/{identityId}")
    public ApiResponse<UserIdentityVO> getById(@PathVariable String userId, @PathVariable String identityId) {
        UserIdentityVO identity = userIdentityService.getById(identityId);
        return ApiResponse.success(identity);
    }

    @PostMapping
    public ApiResponse<Void> create(@PathVariable String userId, @Valid @RequestBody UserIdentitySaveDTO dto) {
        userIdentityService.save(userId, dto);
        return ApiResponse.success();
    }

    @PutMapping("/{identityId}")
    public ApiResponse<Void> update(@PathVariable String userId, @PathVariable String identityId, @RequestBody UserIdentitySaveDTO dto) {
        userIdentityService.update(identityId, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{identityId}")
    public ApiResponse<Void> delete(@PathVariable String userId, @PathVariable String identityId) {
        userIdentityService.delete(identityId);
        return ApiResponse.success();
    }

    @PostMapping("/{identityId}/switch")
    public ApiResponse<Void> switchIdentity(@PathVariable String userId, @PathVariable String identityId) {
        userIdentityService.switchIdentity(userId, identityId);
        return ApiResponse.success();
    }
}