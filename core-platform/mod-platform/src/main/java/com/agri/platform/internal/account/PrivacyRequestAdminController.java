package com.agri.platform.internal.account;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.api.facade.MessageFacade;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * 隐私与数据申请处理（运营端）。
 *
 * <p><b>重要：本控制器只改单据状态，不执行导出、也不删账号。</b>
 * 导出要跨多个业务库取数，注销要连带处理主体归属、未结清交易、合同与审计留存 ——
 * 这些都不是一个接口能安全做完的事。运营在系统外办完后回到这里置为 completed，
 * 用户端看到的是"已办结 + 处理说明"，而不是被假装自动化掉的删除动作。</p>
 *
 * <p><b>权限</b>：挂在 {@code /api/v1/admin/privacy-requests/**}，收进 {@code SUPER_ADMIN_ONLY}。
 * 注销与导出都能动到"账号是否存在"，比普通运营权限高一级。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/privacy-requests")
@RequiredArgsConstructor
public class PrivacyRequestAdminController {

    private final PrivacyRequestMapper privacyRequestMapper;
    private final UserMapper userMapper;
    private final MessageFacade messageFacade;

    /**
     * 分页查询隐私请求。
     *
     * @param status 单据状态：pending / processing / completed / rejected / cancelled；空或 all 表示全部
     * @param type   export / deletion；空或 all 表示全部
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type) {
        int p = Math.max(pageNum, 1);
        int size = Math.min(Math.max(pageSize, 1), 100);
        LambdaQueryWrapper<PrivacyRequestEntity> wrapper = new LambdaQueryWrapper<PrivacyRequestEntity>()
                .eq(hasValue(status), PrivacyRequestEntity::getStatus, status)
                .eq(hasValue(type), PrivacyRequestEntity::getRequestType, type)
                .orderByAsc(PrivacyRequestEntity::getStatus)
                .orderByDesc(PrivacyRequestEntity::getCreatedAt)
                .orderByDesc(PrivacyRequestEntity::getId);
        Page<PrivacyRequestEntity> result = privacyRequestMapper.selectPage(new Page<>(p, size), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (PrivacyRequestEntity entity : result.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("userId", String.valueOf(entity.getUserId()));
            row.put("requestType", entity.getRequestType());
            row.put("reason", entity.getReason());
            row.put("scope", entity.getScope());
            row.put("status", entity.getStatus());
            row.put("handlerName", entity.getHandlerName());
            row.put("handleRemark", entity.getHandleRemark());
            row.put("submitTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
            row.put("handleTime", entity.getHandleTime() == null ? null : entity.getHandleTime().toString());
            UserEntity applicant = userMapper.selectById(entity.getUserId());
            row.put("applicantName", applicant == null ? null
                    : (applicant.getNickname() == null ? applicant.getUsername() : applicant.getNickname()));
            row.put("applicantPhone", applicant == null ? null : applicant.getPhone());
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
     * 处理一条隐私请求。
     *
     * <p>合法流转：pending/processing → completed 或 rejected。终态不再接受处理，
     * 避免"先驳回又通过"这种自相矛盾的记录。</p>
     */
    @PostMapping("/{id}/handle")
    public ApiResponse<Void> handle(@PathVariable Long id, @RequestBody HandleRequest body) {
        PrivacyRequestEntity entity = privacyRequestMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "申请单不存在");
        }
        if (!"pending".equals(entity.getStatus()) && !"processing".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该申请已办结，不能再处理");
        }
        String status = body == null || body.status() == null ? "" : body.status().trim();
        if (!"completed".equals(status) && !"rejected".equals(status)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处理结果只能是 completed 或 rejected");
        }
        String remark = body.remark() == null ? "" : body.remark().trim();
        if (remark.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写处理说明（用户会看到这段内容）");
        }
        if (remark.length() > 500) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处理说明最多 500 字");
        }
        Long handlerId = MarketContext.currentUserId();
        UserEntity handler = handlerId == null ? null : userMapper.selectById(handlerId);
        entity.setStatus(status);
        entity.setHandlerId(handlerId);
        entity.setHandlerName(handler == null ? "平台运营"
                : (handler.getNickname() == null ? handler.getUsername() : handler.getNickname()));
        entity.setHandleTime(LocalDateTime.now());
        entity.setHandleRemark(remark);
        privacyRequestMapper.updateById(entity);
        notifyApplicant(entity, remark);
        return ApiResponse.ok();
    }

    /** 办结后通知申请人；失败只记日志，不回滚已办结的状态 */
    private void notifyApplicant(PrivacyRequestEntity entity, String remark) {
        try {
            String label = "deletion".equals(entity.getRequestType()) ? "账号注销" : "数据导出";
            String prefix = "completed".equals(entity.getStatus()) ? "已办结" : "未通过";
            messageFacade.notify(entity.getUserId(), entity.getMarketId(),
                    String.format("%s申请%s", label, prefix),
                    remark);
        } catch (RuntimeException e) {
            log.warn("发送隐私申请结果站内信失败（不影响办理结果）：{}", e.getMessage());
        }
    }

    private boolean hasValue(String value) {
        return value != null && !value.isBlank() && !"all".equalsIgnoreCase(value);
    }

    /** 处理入参：status=completed|rejected，remark 必填（用户会看到） */
    public record HandleRequest(String status, String remark) {
    }
}
