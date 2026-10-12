package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.service.IUserProfileService;
import com.agri.masterdata.vo.UserProfileVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/master-data/users/{userId}/profiles")
@RequiredArgsConstructor
public class UserProfileController {

    private final IUserProfileService userProfileService;

    @GetMapping
    public ApiResponse<List<UserProfileVO>> list(@PathVariable String userId) {
        List<UserProfileVO> profiles = userProfileService.listByUserId(userId);
        return ApiResponse.success(profiles);
    }

    @GetMapping("/{profileType}")
    public ApiResponse<UserProfileVO> getByType(@PathVariable String userId, @PathVariable String profileType) {
        UserProfileVO profile = userProfileService.getByUserIdAndType(userId, profileType);
        return ApiResponse.success(profile);
    }

    @PostMapping("/{profileType}")
    public ApiResponse<Void> saveOrUpdate(@PathVariable String userId, @PathVariable String profileType, @RequestBody Map<String, Object> profileData) {
        userProfileService.saveOrUpdate(userId, profileType, profileData);
        return ApiResponse.success();
    }

    @PostMapping("/tags")
    public ApiResponse<Void> addTags(@PathVariable String userId, @RequestBody List<String> tags) {
        userProfileService.addTags(userId, tags);
        return ApiResponse.success();
    }

    @DeleteMapping("/tags")
    public ApiResponse<Void> removeTags(@PathVariable String userId, @RequestBody List<String> tags) {
        userProfileService.removeTags(userId, tags);
        return ApiResponse.success();
    }

    @PostMapping("/scores")
    public ApiResponse<Void> updateScores(@PathVariable String userId, @RequestBody Map<String, Object> scores) {
        userProfileService.updateScores(userId, scores);
        return ApiResponse.success();
    }
}