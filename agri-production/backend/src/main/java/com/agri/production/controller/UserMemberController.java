package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IUserMemberService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.UserMemberVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 用户端：团队与人员（{@code /api/v1/production/members}）。
 *
 * <p>页面（团队与人员 / 角色与权限）用到的路径：GET 列表、POST 邀请、PUT 更新（含停用启用，
 * 页面就是发 PUT {status}）、DELETE 移除、GET /members/roles（按角色聚合在职人数）。</p>
 *
 * <p>刻意不实现 {@code GET /members/{id}} 与 {@code GET /members/by-farm}：页面没有调用它们
 * （api 层有函数但无页面引用），未实现时由网关回退到平台侧，属预期。若日后有页面要用，
 * 记得先看它们的字段口径 —— 平台侧返回的是 prod_member 实体名，与本服务的出参名不是一套。</p>
 */
@RestController
@RequestMapping("/api/v1/production/members")
public class UserMemberController {

    private final IUserMemberService memberService;

    public UserMemberController(IUserMemberService memberService) {
        this.memberService = memberService;
    }

    /** 成员分页（keyword / status / farmId 可选）。 */
    @GetMapping
    public ApiResponse<PageResult<UserMemberVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String farmId) {
        return ApiResponse.success(memberService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                TenantContextService.currentTenantId(), keyword, status, farmId));
    }

    /** 邀请/新增成员（返回新成员编号）。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(memberService.create(
                TenantContextService.currentTenantId(), payloadOf(body)));
    }

    /** 更新成员（页面停用/启用也走这里，body {status}）。 */
    @PutMapping("/{memberId}")
    public ApiResponse<UserMemberVO> update(@PathVariable String memberId,
                                           @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(memberService.update(
                TenantContextService.currentTenantId(), memberId, payloadOf(body)));
    }

    /** 移除成员（逻辑删除）。 */
    @DeleteMapping("/{memberId}")
    public ApiResponse<Void> delete(@PathVariable String memberId) {
        memberService.delete(TenantContextService.currentTenantId(), memberId);
        return ApiResponse.success();
    }

    /** 按角色聚合在职人数（页面「角色与权限」的"在职人数"列）。 */
    @GetMapping("/roles")
    public ApiResponse<List<Map<String, Object>>> roleHeadcount() {
        return ApiResponse.success(memberService.roleHeadcount(TenantContextService.currentTenantId()));
    }

    /* ==================== 参数小工具 ==================== */

    /**
     * 把请求体整理成 service 的入参。
     *
     * <p>{@code status} 用 {@code numOrNull} 而不是直接强转：页面的停用/启用只发一个 {"status":1}，
     * 但新增时状态可能是字符串；转不动时报 400「状态应为…」比 ClassCastException 的 500 清楚。</p>
     */
    private static IUserMemberService.MemberPayload payloadOf(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        return new IUserMemberService.MemberPayload(
                str(body.get("memberName")),
                str(body.get("phone")),
                str(body.get("memberType")),
                str(body.get("postName")),
                str(body.get("roleCode")),
                str(body.get("farmId")),
                str(body.get("userId")),
                str(body.get("joinDate")),
                intOrNull(body.get("status")));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer intOrNull(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            throw new com.agri.production.common.exception.BusinessException(400, "成员状态应为整数：" + text);
        }
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
