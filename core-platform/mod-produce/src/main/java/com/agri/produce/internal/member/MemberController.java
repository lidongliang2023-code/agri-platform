package com.agri.produce.internal.member;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 生产团队与人员（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ApiResponse<PageResult<MemberEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                      @RequestParam(defaultValue = "10") long size,
                                                      @RequestParam(required = false) String keyword,
                                                      @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(memberService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<MemberEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(memberService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody MemberEntity entity) {
        return ApiResponse.ok(memberService.create(entity).getMemberId());
    }

    @PutMapping("/{id}")
    public ApiResponse<MemberEntity> update(@PathVariable String id, @RequestBody MemberEntity entity) {
        return ApiResponse.ok(memberService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        memberService.delete(id);
        return ApiResponse.ok();
    }

    /** 农场成员 */
    @GetMapping("/by-farm")
    public ApiResponse<List<MemberEntity>> byFarm(@RequestParam String farmId) {
        return ApiResponse.ok(memberService.listByFarm(farmId));
    }

    /** 绑定平台账号 */
    @PostMapping("/{memberId}/bind-user")
    public ApiResponse<MemberEntity> bindUser(@PathVariable String memberId, @RequestParam String userId) {
        return ApiResponse.ok(memberService.bindUser(memberId, userId));
    }

    /** 角色列表（按 role_code 去重统计） */
    @GetMapping("/roles")
    public ApiResponse<List<Map<String, Object>>> roles() {
        return ApiResponse.ok(memberService.roles());
    }

    /** 角色权限（骨架） */
    @GetMapping("/roles/permissions")
    public ApiResponse<List<Map<String, Object>>> rolePermissions(@RequestParam(required = false) String roleCode) {
        return ApiResponse.ok(memberService.rolePermissions(roleCode));
    }
}
