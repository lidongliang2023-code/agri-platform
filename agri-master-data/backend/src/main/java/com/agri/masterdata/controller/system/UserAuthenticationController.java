package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.UserAuthApplyDTO;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.service.IUserAuthenticationService;
import com.agri.masterdata.vo.UserAuthenticationVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master-data/authentications")
@RequiredArgsConstructor
public class UserAuthenticationController {

    private final IUserAuthenticationService userAuthenticationService;

    @GetMapping("/user/{userId}")
    public ApiResponse<List<UserAuthenticationVO>> listByUser(@PathVariable String userId) {
        List<UserAuthenticationVO> auths = userAuthenticationService.listByUserId(userId);
        return ApiResponse.success(auths);
    }

    @GetMapping("/status/{authStatus}")
    public ApiResponse<List<UserAuthenticationVO>> listByStatus(@PathVariable String authStatus) {
        List<UserAuthenticationVO> auths = userAuthenticationService.listByStatus(authStatus);
        return ApiResponse.success(auths);
    }

    @GetMapping("/{authId}")
    public ApiResponse<UserAuthenticationVO> getById(@PathVariable String authId) {
        UserAuthenticationVO auth = userAuthenticationService.getById(authId);
        return ApiResponse.success(auth);
    }

    @PostMapping("/user/{userId}/apply")
    public ApiResponse<Void> apply(@PathVariable String userId, @Valid @RequestBody UserAuthApplyDTO dto) {
        userAuthenticationService.apply(userId, dto);
        return ApiResponse.success();
    }

    @PutMapping("/{authId}/review")
    public ApiResponse<Void> review(@PathVariable String authId, @Valid @RequestBody UserAuthReviewDTO dto) {
        userAuthenticationService.review(authId, dto);
        return ApiResponse.success();
    }
}