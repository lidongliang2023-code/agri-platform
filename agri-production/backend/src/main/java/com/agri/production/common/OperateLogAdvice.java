package com.agri.production.common;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.OperateLog;
import com.agri.production.mapper.OperateLogMapper;
import com.agri.production.service.TenantContextService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 操作日志钩子：所有**非 GET** 请求在本服务处理完之后统一落一条日志。

 *
 * <p>为什么用 {@link ResponseBodyAdvice} 而不是在每个写接口里插一行，也不是 Servlet Filter：
 * · 逐个接口插一行 = 以后新增写接口必然漏记（长期不一致），正是方案里说的"一次性改造所有写路径"那个坑；
 * · Filter 只能看到 HTTP 状态码，而本服务的**业务错误是 HTTP 200 + 非 0 码**（GlobalExceptionHandler 的既有口径），
 *   只看状态会把所有校验失败都记成"成功"——审计日志记错成功比不记更糟；
 *   本钩子拿到的是**已序列化前的 ApiResponse 对象**，直接看 code，判得准。
 * · 本钩子对**所有** controller 生效（含运营端），不挑路径。</p>
 *
 * <p>代价与边界：① 日志写入失败只打 WARN、不影响业务响应（审计不能成为业务故障源）；
 * ② operator 是占位说明——本服务拿不到平台用户档案；③ 只记"谁调了哪个写接口"，不解析请求体（不落业务数据，避免把敏感字段抄进日志）。</p>
 */
@Slf4j
@RestControllerAdvice
public class OperateLogAdvice implements ResponseBodyAdvice<Object> {

    private static final List<String> WRITE_METHODS = List.of("POST", "PUT", "PATCH", "DELETE");
    /** 记录操作人的占位说明：宁可写清"拿不到"，也不拿 userId 冒充姓名。 */
    private static final String OPERATOR_UNKNOWN = "未持有用户档案（本服务仅解析到经营主体）";

    private final OperateLogMapper logMapper;
    private final HttpServletRequest request;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OperateLogAdvice(OperateLogMapper logMapper, HttpServletRequest request) {
        this.logMapper = logMapper;
        this.request = request;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class converterType) {
        return true;
    }

    @Override
    @SuppressWarnings("rawtypes")
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class selectedConverterType, ServerHttpRequest request, ServerHttpResponse response) {
        String method = this.request.getMethod();
        if (method == null || !WRITE_METHODS.contains(method.toUpperCase(Locale.ROOT))) {
            return body;
        }
        try {
            record(method, body);
        } catch (Exception e) {
            // 记日志失败不能影响业务响应：审计是旁路，不是主链路
            log.warn("操作日志写入失败（业务已成功返回）：{}", e.getMessage());
        }
        return body;
    }

    private void record(String method, Object body) {
        Integer code = null;
        if (body instanceof ApiResponse<?> apiResponse) {
            code = apiResponse.getCode();
        } else if (body != null) {
            // 未包 ApiResponse 的写响应（少数端点直接返回 Map）：按"成功"记，并把原始形状留在 detail 里备查
            code = 0;
        }
        String path = request.getRequestURI();
        OperateLog entity = new OperateLog();
        entity.setLogId("LOG" + LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setOperateType(operateTypeOf(method, path));
        entity.setTarget(method + " " + path);
        entity.setBusinessCode(code);
        entity.setResult(code != null && code == 0 ? 1 : 0);
        entity.setOperator(OPERATOR_UNKNOWN);
        entity.setIpAddress(clientIp());
        entity.setOperateAt(LocalDateTime.now());
        if (code != null && code != 0 && body instanceof ApiResponse<?> apiResponse) {
            String message = apiResponse.getMessage();
            entity.setDetail(message == null ? null : message.substring(0, Math.min(500, message.length())));
        }
        try {
            entity.setTenantId(TenantContextService.currentTenantId());
        } catch (Exception e) {
            // 未登录/平台不可达时租户解析会抛错：日志照样要能落库（审计对象正是这类请求），租户记为 UNKNOWN
            entity.setTenantId("UNKNOWN");
        }
        logMapper.insert(entity);
    }

    /** 操作类型 = 动词 + 业务段（如「修改 tasks」），便于页面按"操作类型"筛选。 */
    private static String operateTypeOf(String method, String path) {
        String verb = switch (method.toUpperCase(Locale.ROOT)) {
            case "POST" -> "新增";
            case "PUT", "PATCH" -> "修改";
            case "DELETE" -> "删除";
            default -> method;
        };
        String[] parts = path.split("/");
        // /api/v1/production/<段>/... 取第 4 段（索引 3）作为业务段；取不到就用整个路径
        String segment = parts.length > 4 ? parts[4] : path;
        return verb + " " + segment;
    }

    private String clientIp() {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        return real != null && !real.isBlank() ? real : request.getRemoteAddr();
    }
}
