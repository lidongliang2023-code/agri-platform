package com.agri.masterdata.aspect;

import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.OperationLog;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.validation.Errors;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 运营端操作留痕切面 —— 「权限审计 → 操作日志」的数据来源。
 *
 * <p><b>为什么另起一个切面，而不去用仓库里既有的 {@code com.agri.common.aspect.LogAspect}：</b>
 * 那套 {@code @LogOperation} 注解写了快两年，<b>全仓库没有任何一个方法用过它</b>，
 * 切点 {@code @annotation(LogOperation)} 因此从未命中过；而且它即使命中，也只写 SLF4J 文本日志，
 * 一个字节都不落库。所以操作日志页此前空着是必然的，不是"数据还没产生"。</p>
 *
 * <p><b>留痕口径：全部写操作</b>（POST / PUT / PATCH / DELETE），失败也记
 * （{@code result=fail} + {@code error_message}）。这里刻意用 HTTP 方法而不是
 * {@code @PostMapping} 注解来判定：注解判定依赖 AspectJ 对元注解（@PostMapping 上还套着
 * @RequestMapping）的解析，行为随版本而变；HTTP 方法是请求自带的客观事实，没有歧义。
 * 查询接口（GET）不记 —— 它们占请求量九成以上，记了只会把真正需要审计的写操作淹掉。</p>
 *
 * <p><b>模块名与操作描述直接复用控制器的 Swagger 元数据</b>：类上的 {@code @Tag(name=...)}
 * 就是"租户管理"这种模块名，方法上的 {@code @Operation(summary=...)} 就是"创建租户"这种操作名，
 * 正是页面要展示的文案。好处是不需要给四十多个方法逐个补注解 —— 新接口只要按项目既有习惯写了
 * Swagger 注解，留痕文案自动就有了。</p>
 *
 * <p><b>绝不影响业务</b>：整段落库逻辑包在 try/catch 里，日志写失败只打一条 warn。
 * 审计是旁路，不该有机会把一次正常的业务操作变成 500。</p>
 */
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AdminOperationLogAspect {

    /** 需要留痕的 HTTP 方法。PATCH 目前没用上，留着以免将来加了新方法却悄悄不留痕。 */
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    /** 参数摘要长度上限，与 agri_md_operation_log.params 的 VARCHAR(1000) 对齐。 */
    private static final int PARAMS_MAX_LENGTH = 1000;

    private static final int MODULE_MAX_LENGTH = 128;
    private static final int DESC_MAX_LENGTH = 255;
    private static final int URI_MAX_LENGTH = 255;
    private static final int ERROR_MAX_LENGTH = 500;

    /**
     * 口令类字段脱敏。
     *
     * <p>本模块的 {@code POST /api/auth/login} 和 {@code /api/auth/register} 都是写操作，
     * 请求体里明明白白带着明文口令。参数摘要是要落库、还要在页面上给人看的，
     * 不脱敏等于把口令写进审计表 —— 审计日志的可读性再重要，也不能拿这个换。</p>
     */
    private static final Pattern SENSITIVE_FIELD = Pattern.compile(
            "(\"(?:password|pwd|passwd|oldPassword|newPassword|confirmPassword|captcha)\"\\s*:\\s*)\"[^\"]*\"");

    /** 操作类型判定用的关键词。<b>顺序有意义</b>：先判删除，再判新增，剩下的归到修改。 */
    private static final String[] DELETE_WORDS = {"删除", "移除"};
    private static final String[] CREATE_WORDS = {"创建", "新增", "添加", "新建", "登记"};
    private static final String[] UPDATE_WORDS = {"编辑", "更新", "修改", "调整", "配置", "设置",
            "启用", "禁用", "停用", "恢复", "重试", "暂停", "处理", "审核", "审批", "导入",
            "分发", "冻结", "解冻", "批量"};

    private final OperationLogMapper operationLogMapper;
    private final ObjectMapper objectMapper;

    /**
     * 切点只覆盖两个控制器包树。
     *
     * <p>刻意不写成 {@code execution(public * com.agri..*(..))}：那样会把 service、mapper
     * 也一起代理进来，徒增开销且会让堆栈变长；这里只关心"HTTP 入口"。</p>
     */
    @Around("execution(public * com.agri.admin.controller..*(..))"
            + " || execution(public * com.agri.masterdata.controller..*(..))")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        HttpServletRequest request = currentRequest();
        if (request == null || !WRITE_METHODS.contains(request.getMethod().toUpperCase())) {
            return joinPoint.proceed();
        }

        long startMillis = System.currentTimeMillis();
        Throwable failure = null;
        try {
            return joinPoint.proceed();
        } catch (Throwable e) {
            // 失败也要留痕：一次被拒绝的删除同样是审计关心的信息。
            // 记下来之后原样抛出，绝不吞异常。
            failure = e;
            throw e;
        } finally {
            try {
                save(joinPoint, request, System.currentTimeMillis() - startMillis, failure);
            } catch (Exception e) {
                log.warn("操作日志落库失败（不影响本次业务）: {}", e.toString());
            }
        }
    }

    private void save(ProceedingJoinPoint joinPoint, HttpServletRequest request,
                      long durationMs, Throwable failure) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        // CGLIB 代理类的类名带 $$ 后缀、且不带被代理类自己的注解，必须还原到真实控制器类
        Class<?> targetClass = joinPoint.getTarget() != null
                ? AopUtils.getTargetClass(joinPoint.getTarget())
                : method.getDeclaringClass();
        Method targetMethod = resolveMethod(targetClass, method);

        Tag tag = AnnotatedElementUtils.findMergedAnnotation(targetClass, Tag.class);
        Operation operation = AnnotatedElementUtils.findMergedAnnotation(targetMethod, Operation.class);
        String summary = operation != null ? operation.summary() : "";

        String uri = request.getRequestURI();
        String httpMethod = request.getMethod().toUpperCase();
        String username = SecurityUtils.getUsername();

        OperationLog entity = new OperationLog();
        entity.setModule(truncate(tag != null ? tag.name() : targetClass.getSimpleName(), MODULE_MAX_LENGTH));
        entity.setOperationType(resolveOperationType(summary, httpMethod));
        entity.setOperationDesc(truncate(summary, DESC_MAX_LENGTH));
        entity.setTargetId(extractTargetId(uri));
        entity.setRequestMethod(httpMethod);
        entity.setRequestUri(truncate(uri, URI_MAX_LENGTH));
        // 登录接口在认证之前执行，此时上下文里没有用户，如实写"未登录"而不是留空，
        // 免得页面上出现一行没有任何操作人的记录、看起来像数据坏了。
        entity.setOperator(username != null ? username : "未登录");
        entity.setOperatorId(SecurityUtils.getUserId());
        entity.setIpAddress(clientIp(request));
        entity.setParams(truncate(describeArgs(joinPoint.getArgs()), PARAMS_MAX_LENGTH));
        entity.setResult(failure == null ? "success" : "fail");
        entity.setErrorMessage(failure == null ? null : truncate(failure.getMessage(), ERROR_MAX_LENGTH));
        entity.setDurationMs(durationMs);
        entity.setTenantId(SecurityUtils.getTenantId());
        entity.setCreateTime(LocalDateTime.now());

        operationLogMapper.insert(entity);
    }

    /**
     * 把 HTTP 方法 + 接口摘要折成页面上那几种操作类型。
     *
     * <p>只按 HTTP 方法判是不够的：{@code POST /quality/tasks/{id}/run} 是"执行检测"，
     * 归成"新增"会让审计表说谎。所以优先看摘要里的动词，摘要拿不到（新接口忘了写 Swagger
     * 注解）才退回 HTTP 方法。</p>
     */
    private String resolveOperationType(String summary, String httpMethod) {
        if (summary != null && !summary.isBlank()) {
            if (containsAny(summary, DELETE_WORDS)) {
                return "delete";
            }
            if (containsAny(summary, CREATE_WORDS)) {
                return "create";
            }
            if (containsAny(summary, UPDATE_WORDS)) {
                return "update";
            }
            return "other";
        }
        return switch (httpMethod) {
            case "POST" -> "create";
            case "PUT", "PATCH" -> "update";
            case "DELETE" -> "delete";
            default -> "other";
        };
    }

    /**
     * 从请求路径里取目标 ID：<b>从后往前找第一个纯数字段</b>。
     *
     * <p>比"取最后一段"稳：{@code /tenant/5/status} 的最后一段是 {@code status}，
     * 倒着找就能拿到 5。路径里没有数字（如 {@code /api/auth/login}）就留空 ——
     * 这类接口本来就没有"哪个对象被改了"这回事，编一个 ID 出来只会误导。</p>
     */
    private String extractTargetId(String uri) {
        if (uri == null) {
            return null;
        }
        String[] segments = uri.split("/");
        for (int i = segments.length - 1; i >= 0; i--) {
            String segment = segments[i];
            if (!segment.isEmpty() && segment.chars().allMatch(Character::isDigit)) {
                return segment.length() > 64 ? null : segment;
            }
        }
        return null;
    }

    /**
     * 参数摘要。用 Jackson 序列化成 JSON（比 {@code Arrays.toString} 可读得多）。
     *
     * <p>文件流、字节数组、Servlet 对象一律跳过：它们要么序列化不出来，要么会把
     * 一个 {@code [B@1f2e3d} 这种毫无意义的字符串写进审计表，要么内容大到没边。</p>
     */
    private String describeArgs(Object[] args) {
        if (args == null || args.length == 0) {
            return "";
        }
        List<Object> printable = new ArrayList<>();
        for (Object arg : args) {
            if (arg == null
                    || arg instanceof ServletRequest || arg instanceof ServletResponse
                    || arg instanceof MultipartFile || arg instanceof MultipartFile[]
                    || arg instanceof byte[] || arg instanceof InputStream
                    || arg instanceof Errors
                    || arg instanceof java.io.File) {
                continue;
            }
            printable.add(arg);
        }
        if (printable.isEmpty()) {
            return "";
        }
        try {
            Object payload = printable.size() == 1 ? printable.get(0) : printable;
            return mask(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            // 序列化不出来的对象（比如 Lambda）不该让整条日志丢掉，退回 toString 摘要
            return mask(printable.toString());
        }
    }

    private String mask(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        Matcher matcher = SENSITIVE_FIELD.matcher(text);
        return matcher.replaceAll("$1\"***\"");
    }

    /** IP 取法沿用仓库既有的优先级：代理头在前，直连地址兜底。 */
    private String clientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (isBlankOrUnknown(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (isBlankOrUnknown(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (isBlankOrUnknown(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return truncate(ip, 64);
    }

    private static Method resolveMethod(Class<?> targetClass, Method method) {
        try {
            return targetClass.getMethod(method.getName(), method.getParameterTypes());
        } catch (NoSuchMethodException e) {
            return method;
        }
    }

    private static boolean containsAny(String text, String[] words) {
        for (String word : words) {
            if (text.contains(word)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isBlankOrUnknown(String value) {
        return value == null || value.isEmpty() || "unknown".equalsIgnoreCase(value);
    }

    private static String truncate(String text, int maxLength) {
        if (text == null) {
            return null;
        }
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
    }

    private static HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }
}
