package com.agri.platform.internal.account;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 用户操作日志写入。
 *
 * <p><b>永远不抛异常</b>：记日志是附加动作，不能因为日志表写失败把"改密码成功"回滚成失败。
 * 出问题时只打 warn，由运维从日志里发现。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserOperationLogService {

    private final UserOperationLogMapper logMapper;

    /**
     * 记录一条操作。
     *
     * @param userId      账号 ID
     * @param action      动作编码
     * @param actionLabel 动作中文名
     * @param target      操作对象，可空
     * @param detail      补充说明，可空
     */
    public void record(Long userId, String action, String actionLabel, String target, String detail) {
        if (userId == null || action == null) {
            return;
        }
        try {
            HttpServletRequest request = currentRequest();
            UserOperationLogEntity entity = new UserOperationLogEntity();
            entity.setUserId(userId);
            entity.setAction(action);
            entity.setActionLabel(actionLabel);
            entity.setTarget(trimTo(target, 255));
            entity.setDetail(trimTo(detail, 500));
            entity.setResult("success");
            if (request != null) {
                entity.setIp(trimTo(clientIpOf(request), 64));
                entity.setUserAgent(trimTo(request.getHeader("User-Agent"), 255));
            }
            logMapper.insert(entity);
        } catch (RuntimeException e) {
            log.warn("写用户操作日志失败（不影响业务）：{}", e.getMessage());
        }
    }

    private HttpServletRequest currentRequest() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servlet ? servlet.getRequest() : null;
    }

    /** 取真实客户端 IP：优先 X-Forwarded-For 第一段（本机在 nginx 后面） */
    private static String clientIpOf(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    private static String trimTo(String value, int max) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        if (text.isEmpty()) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max);
    }
}
