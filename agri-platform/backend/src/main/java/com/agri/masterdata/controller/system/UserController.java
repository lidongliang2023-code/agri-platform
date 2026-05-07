package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ChangePasswordDTO;
import com.agri.masterdata.dto.UserPageDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.UserVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/user")
@RequiredArgsConstructor
public class UserController {

    private final IUserService userService;

    @GetMapping("/page")
    public ApiResponse<PageResult<UserVO>> page(UserPageDTO dto) {
        return ApiResponse.success(userService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(userService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid UserSaveDTO dto) {
        userService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid UserUpdateDTO dto) {
        userService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/resetPassword")
    public ApiResponse<Void> resetPassword(@PathVariable Long id) {
        userService.resetPassword(id);
        return ApiResponse.success();
    }

    @PutMapping("/changePassword")
    public ApiResponse<Void> changePassword(@RequestBody @Valid ChangePasswordDTO dto) {
        userService.changePassword(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Void> changeStatus(@PathVariable Long id, @RequestParam Integer status) {
        userService.changeStatus(id, status);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/roles")
    public ApiResponse<Void> assignRoles(@PathVariable Long id, @RequestBody List<Long> roleIds) {
        userService.assignRoles(id, roleIds);
        return ApiResponse.success();
    }

    @GetMapping("/info")
    public ApiResponse<UserVO> getInfo() {
        return ApiResponse.success(userService.getInfo());
    }
}
