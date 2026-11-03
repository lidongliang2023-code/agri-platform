package com.agri.platform.internal.account;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 身份申请审核（运营端）。
 *
 * <p>用户中心「身份申请」的审批侧：列表 + 通过/驳回。</p>
 *
 * <p><b>权限</b>：路径挂在 {@code /api/v1/admin/identity-applications/**}，
 * 已加入 {@code JwtAuthFilter} 的 {@code SUPER_ADMIN_ONLY} —— 这类接口能改"别人有没有身份"，
 * 不能只靠"登录了就能调"。</p>
 */
@RestController
@RequestMapping("/api/v1/admin/identity-applications")
@RequiredArgsConstructor
public class IdentityApplicationAdminController {

    private final IdentityApplicationMapper identityApplicationMapper;
    private final UserMapper userMapper;

    /**
     * 分页查询身份申请。
     *
     * @param status 单据状态：pending / approved / rejected / cancelled；为空表示全部
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status) {
        int p = Math.max(pageNum, 1);
        int size = Math.min(Math.max(pageSize, 1), 100);
        LambdaQueryWrapper<IdentityApplicationEntity> wrapper =
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(status != null && !status.isBlank() && !"all".equalsIgnoreCase(status),
                                IdentityApplicationEntity::getStatus, status)
                        .orderByDesc(IdentityApplicationEntity::getCreatedAt)
                        .orderByDesc(IdentityApplicationEntity::getId);
        Page<IdentityApplicationEntity> result =
                identityApplicationMapper.selectPage(new Page<>(p, size), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (IdentityApplicationEntity entity : result.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("userId", String.valueOf(entity.getUserId()));
            row.put("identityType", entity.getIdentityType());
            row.put("subjectName", entity.getSubjectName());
            row.put("creditCode", entity.getCreditCode());
            row.put("businessPlace", entity.getBusinessPlace());
            row.put("businessCategory", entity.getBusinessCategory());
            row.put("annualVolume", entity.getAnnualVolume());
            row.put("contactName", entity.getContactName());
            row.put("contactPhone", entity.getContactPhone());
            row.put("applyNote", entity.getApplyNote());
            row.put("status", entity.getStatus());
            row.put("reviewerName", entity.getReviewerName());
            row.put("reviewRemark", entity.getReviewRemark());
            row.put("applyTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
            row.put("reviewTime", entity.getReviewTime() == null ? null : entity.getReviewTime().toString());
            // 申请人账号名，便于运营核对是谁提交的
            UserEntity applicant = userMapper.selectById(entity.getUserId());
            row.put("applicantName", applicant == null ? null
                    : (applicant.getNickname() == null ? applicant.getUsername() : applicant.getNickname()));
            rows.add(row);
        }
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("records", rows);
        page.put("total", result.getTotal());
        page.put("page", p);
        page.put("size", size);
        return ApiResponse.ok(page);
    }

    /**
     * 审核身份申请。
     *
     * <p>只改单据状态，不动主体绑定、不动 RBAC —— 权限开通由权限模块另行处理。</p>
     */
    @PostMapping("/{id}/review")
    public ApiResponse<Void> review(@PathVariable Long id, @RequestBody ReviewRequest body) {
        IdentityApplicationEntity entity = identityApplicationMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "申请单不存在");
        }
        if (!"pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该申请已处理，不能重复审核");
        }
        if (body == null || body.approved() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择通过或驳回");
        }
        Long reviewerId = MarketContext.currentUserId();
        entity.setStatus(Boolean.TRUE.equals(body.approved()) ? "approved" : "rejected");
        entity.setReviewerId(reviewerId);
        UserEntity reviewer = reviewerId == null ? null : userMapper.selectById(reviewerId);
        entity.setReviewerName(reviewer == null ? "平台审核员"
                : (reviewer.getNickname() == null ? reviewer.getUsername() : reviewer.getNickname()));
        entity.setReviewTime(LocalDateTime.now());
        entity.setReviewRemark(body.remark());
        identityApplicationMapper.updateById(entity);
        return ApiResponse.ok();
    }

    /** 审核入参 */
    public record ReviewRequest(Boolean approved, String remark) {
    }
}
