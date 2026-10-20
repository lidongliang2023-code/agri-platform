package com.agri.core.smoke;

import com.agri.core.infra.event.OutboxRelay;
import com.agri.core.infra.security.JwtUtil;
import com.agri.platform.internal.auth.AdminUserInitializer;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotDeviceService;
import com.agri.shared.result.PageResult;
import com.agri.trade.internal.settlement.SettlementJob;
import org.apache.ibatis.annotations.Mapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 启动与端点注册冒烟（<b>不连数据库</b>，可常驻 CI）。
 *
 * <p>存在理由：本项目历史上出现过五类「编译通过、ArchUnit 也通过，但真机一跑就死」的装配问题。
 * 本测试在同进程内走完整 {@code DispatcherServlet + 过滤器链 + Jackson 序列化}，
 * 不需要端口、不依赖本机 MySQL，把它们钉死在 CI 上：</p>
 * <ol>
 *   <li><b>Bean 名冲突</b>（两个模块同名 Controller）→ 装配期抛
 *       {@code ConflictingBeanDefinitionException}，{@link #contextLoads()} 失败；</li>
 *   <li><b>Mapper 未注册</b> → {@link #allMapperInterfacesAreRegisteredAsBeans()} 失败；</li>
 *   <li><b>Mapper 扫描范围污染</b>（非 Mapper 接口被注册成 Mapper Bean）→ 装配期注入歧义；</li>
 *   <li><b>编译未开 {@code -parameters}</b> → {@link #controllerParametersRetainNames()} 失败；</li>
 *   <li><b>Controller 漏扫 / 包漏配置</b> → {@link #everyEndpointRequiresAuthentication()} 里
 *       端点拿不到 401（通常是 404，说明 Bean 根本没进容器）。</li>
 * </ol>
 *
 * <p>不连库的依据：Hikari 懒初始化；MyBatis 的 {@code SqlSessionFactory} 只装配不查询；
 * 关闭 Flyway 与调度；把会主动查库的启动任务/定时任务换成 Mock；业务查询用 {@code @MockBean} 挡掉。</p>
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.task.scheduling.enabled=false",
        "agri.event.transport=local"
})
@AutoConfigureMockMvc
class CoreAppStartupSmokeTest {

    /** 与 CorePlatformApplication 的 @MapperScan#basePackages 保持一致 */
    private static final List<String> MAPPER_PACKAGES = List.of(
            "com.agri.core.infra",
            "com.agri.platform.internal",
            "com.agri.produce.internal",
            "com.agri.service.internal",
            "com.agri.trade.internal");

    /** 与 JwtAuthFilter#WHITELIST 保持一致：这些路径本就放行，不应断言 401 */
    private static final List<String> AUTH_WHITELIST = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/sso/authorize",
            "/api/v1/sso/login",
            "/api/v1/sso/token",
            "/api/v1/sso/logout",
            "/api/v1/sso/sms/code",
            "/api/v1/sso/login-by-sms",
            "/api/v1/sso/login-standalone",
            "/api/v1/sso/login-standalone-by-sms",
            "/api/v1/sso/register-by-sms",
            "/api/v1/sso/register-account",
            "/api/v1/sso/onboarding/status",
            "/api/v1/sso/onboarding/subject",
            "/api/v1/sso/onboarding/certification",
            "/api/v1/quotes/**",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/actuator/**",
            "/internal/**",
            "/error");

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MockMvc mockMvc;

    /** 容器中还有 actuator 的 controllerEndpointHandlerMapping，需按 Bean 名取 MVC 主映射 */
    @Autowired
    @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @Autowired
    private JwtUtil jwtUtil;

    /** 首启引导会查库建管理员账号 → 换成 Mock */
    @MockBean
    private AdminUserInitializer adminUserInitializer;

    /** outbox 中继按固定间隔扫表 → 换成 Mock */
    @MockBean
    private OutboxRelay outboxRelay;

    /** 结算定时任务同样查库 → 换成 Mock */
    @MockBean
    private SettlementJob settlementJob;

    /** 业务查询用 Mock 挡掉数据库（分页参数与返回结构仍走真实 MVC 链路） */
    @MockBean
    private IotDeviceService iotDeviceService;

    @Test
    @DisplayName("Spring 上下文可完整装配（钉死 Bean 名冲突 / Mapper 注入失败）")
    void contextLoads() {
        assertNotNull(context, "Spring 上下文必须装配成功");
        assertTrue(context.getBeanDefinitionCount() > 0, "上下文中必须有 Bean 定义");
    }

    @Test
    @DisplayName("所有 @Mapper 接口都已注册为 Spring Bean（钉死 @MapperScan 漏扫）")
    void allMapperInterfacesAreRegisteredAsBeans() {
        MapperInterfaceScanner scanner = new MapperInterfaceScanner();
        List<String> missing = new ArrayList<>();
        int checked = 0;

        for (String pkg : MAPPER_PACKAGES) {
            for (BeanDefinition definition : scanner.findCandidateComponents(pkg)) {
                String className = definition.getBeanClassName();
                if (className == null) {
                    continue;
                }
                try {
                    Class<?> type = Class.forName(className);
                    checked++;
                    if (context.getBeanNamesForType(type).length == 0) {
                        missing.add(className);
                    }
                } catch (ClassNotFoundException ex) {
                    missing.add(className + "（类无法加载）");
                }
            }
        }

        assertTrue(checked > 0, "应当扫描到 Mapper 接口，否则扫描范围配置有误");
        assertTrue(missing.isEmpty(),
                "以下 Mapper 未注册为 Spring Bean，检查 @MapperScan 的 basePackages： " + missing);
    }

    @Test
    @DisplayName("Controller 形参保留编译期名字（钉死缺失 -parameters 编译开关）")
    void controllerParametersRetainNames() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        List<String> offenders = new ArrayList<>();
        for (String pkg : List.of("com.agri")) {
            for (BeanDefinition definition : scanner.findCandidateComponents(pkg)) {
                String className = definition.getBeanClassName();
                if (className == null) {
                    continue;
                }
                Class<?> type;
                try {
                    type = Class.forName(className);
                } catch (ClassNotFoundException ex) {
                    continue;
                }
                for (Method method : type.getDeclaredMethods()) {
                    if (!hasMappingAnnotation(method)) {
                        continue;
                    }
                    for (Parameter parameter : method.getParameters()) {
                        if (needsName(parameter) && !parameter.isNamePresent()) {
                            offenders.add(type.getSimpleName() + "#" + method.getName()
                                    + "(" + parameter.getType().getSimpleName() + ")");
                        }
                    }
                }
            }
        }

        assertTrue(offenders.isEmpty(),
                "以下 Controller 形参未保留编译期名字，Spring 无法解析 @RequestParam/@PathVariable，"
                        + "请确认 maven-compiler-plugin 开启了 <parameters>true</parameters>： " + offenders);
    }

    /**
     * 遍历 Spring 实际注册的全部端点（含路径变量已展开），逐个断言「不带 token → 401」。
     *
     * <p>401 证明该 Controller 已被扫进容器且鉴权链路生效；返回 404 说明 Bean 没注册或包漏扫，
     * 正是我们踩过的那类 P0，故此断言失败即构建失败。</p>
     */
    @Test
    @DisplayName("全部端点未带 token 一律 401（钉死 Controller 漏扫 / 包漏配置）")
    void everyEndpointRequiresAuthentication() throws Exception {
        // 端点清单：路径|HTTP方法 -> Controller#method
        Map<String, HandlerMethod> endpoints = new LinkedHashMap<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMapping.getHandlerMethods().entrySet()) {
            Set<HttpMethod> methods = supportedMethodsOf(entry.getKey());
            if (methods.isEmpty()) {
                methods = Set.of(HttpMethod.GET);
            }
            for (String pattern : patternsOf(entry.getKey())) {
                for (HttpMethod method : methods) {
                    endpoints.put(pattern + "|" + method, entry.getValue());
                }
            }
        }

        Map<String, Integer> tally = new TreeMap<>();
        List<String> notUnauthorized = new ArrayList<>();
        int checked = 0;
        int skipped = 0;

        for (Map.Entry<String, HandlerMethod> entry : endpoints.entrySet()) {
            String[] parts = entry.getKey().split("\\|");
            String pattern = parts[0];
            HttpMethod httpMethod = HttpMethod.valueOf(parts[1]);
            String path = expandVariables(pattern);
            if (isWhitelisted(path)) {
                skipped++;
                continue;
            }
            HandlerMethod handler = entry.getValue();
            int status = mockMvc.perform(request(httpMethod, path)).andReturn().getResponse().getStatus();
            checked++;
            String key = handler.getBeanType().getSimpleName() + " → " + status;
            tally.merge(key, 1, Integer::sum);
            if (status != 401) {
                notUnauthorized.add(handler.getBeanType().getSimpleName() + " " + httpMethod + " "
                        + path + " → " + status);
            }
        }

        StringBuilder report = new StringBuilder();
        report.append("===== 端点鉴权冒烟：已校验 ").append(checked)
                .append(" 个端点（白名单/非 CRUD 方法跳过 ").append(skipped).append(" 个）=====")
                .append(System.lineSeparator());
        tally.forEach((key, count) -> report.append("  ").append(key).append("  ×").append(count)
                .append(System.lineSeparator()));
        String text = report.toString();
        System.out.println(text);
        writeCoverageReport(text);

        assertTrue(checked > 0, "必须至少校验到一个端点");
        assertTrue(notUnauthorized.isEmpty(),
                "以下端点未返回 401（404 通常意味着 Controller 没被扫进 Spring 容器）： " + notUnauthorized);
    }

    /**
     * 分页参数别名（{@code pageNum}/{@code pageSize}）可正常绑定，且返回体 {@code data.records} 结构正确。
     * 带真实 JWT，业务查询由 Mock 挡库。
     */
    @Test
    @DisplayName("pageNum/pageSize 别名可绑定，且 data.records 结构正确（不查库）")
    void paginationAliasParamsAreAccepted() throws Exception {
        IotDeviceEntity device = new IotDeviceEntity();
        device.setDeviceId("DEVC-SMOKE-001");
        device.setDeviceCode("SMOKE-001");
        device.setDeviceName("冒烟设备");
        when(iotDeviceService.page(eq(1L), eq(1L), isNull(), isNull(), isNull()))
                .thenReturn(PageResult.of(List.of(device), 1L, 1L, 1L));

        String token = jwtUtil.createAccessToken(1L, "admin", 1L, List.of("SUPER_ADMIN"));

        mockMvc.perform(get("/api/v1/production/iot/devices")
                        .header("Authorization", "Bearer " + token)
                        .param("pageNum", "1")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records.length()").value(1))
                .andExpect(jsonPath("$.data.records[0].deviceId").value("DEVC-SMOKE-001"));
    }

    // ------------------------------------------------------------------ 工具方法

    /** 把覆盖率表落到构建产物目录，便于 CI 归档与人工核对（不写源码目录） */
    private static void writeCoverageReport(String text) {
        try {
            java.nio.file.Path dir = java.nio.file.Path.of("target", "smoke-report");
            java.nio.file.Files.createDirectories(dir);
            java.nio.file.Files.writeString(dir.resolve("endpoint-auth-coverage.txt"), text,
                    java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException ex) {
            System.out.println("（覆盖率表写盘失败，不影响断言：）" + ex.getMessage());
        }
    }

    private static Set<String> patternsOf(RequestMappingInfo info) {
        if (info.getPathPatternsCondition() != null) {
            Set<String> values = info.getPathPatternsCondition().getPatternValues();
            if (values != null && !values.isEmpty()) {
                return values;
            }
        }
        if (info.getPatternsCondition() != null) {
            return info.getPatternsCondition().getPatterns();
        }
        return Set.of();
    }

    private static Set<HttpMethod> supportedMethodsOf(RequestMappingInfo info) {
        Set<HttpMethod> result = new LinkedHashSet<>();
        for (org.springframework.web.bind.annotation.RequestMethod method
                : info.getMethodsCondition().getMethods()) {
            result.add(HttpMethod.valueOf(method.name()));
        }
        return result;
    }

    private static boolean isWhitelisted(String path) {
        return AUTH_WHITELIST.stream().anyMatch(p -> PATH_MATCHER.match(p, path));
    }

    /** 把 {@code {deviceId}} 之类的路径变量替换成占位值，便于直接发起请求 */
    private static String expandVariables(String pattern) {
        return pattern.replaceAll("\\{[^/}]+}", "1");
    }

    private static boolean hasMappingAnnotation(Method method) {
        return method.isAnnotationPresent(RequestMapping.class)
                || method.isAnnotationPresent(org.springframework.web.bind.annotation.GetMapping.class)
                || method.isAnnotationPresent(org.springframework.web.bind.annotation.PostMapping.class)
                || method.isAnnotationPresent(org.springframework.web.bind.annotation.PutMapping.class)
                || method.isAnnotationPresent(org.springframework.web.bind.annotation.DeleteMapping.class)
                || method.isAnnotationPresent(org.springframework.web.bind.annotation.PatchMapping.class);
    }

    /** 只有未显式指定 name/value 的 @RequestParam / @PathVariable 才依赖编译期参数名 */
    private static boolean needsName(Parameter parameter) {
        RequestParam requestParam = parameter.getAnnotation(RequestParam.class);
        if (requestParam != null && requestParam.name().isEmpty() && requestParam.value().isEmpty()) {
            return true;
        }
        PathVariable pathVariable = parameter.getAnnotation(PathVariable.class);
        return pathVariable != null && pathVariable.name().isEmpty() && pathVariable.value().isEmpty();
    }

    /** 扫描 @Mapper 标注的接口（默认扫描器会排除接口，故放宽候选判定） */
    private static final class MapperInterfaceScanner extends ClassPathScanningCandidateComponentProvider {

        private MapperInterfaceScanner() {
            super(false);
            addIncludeFilter(new AnnotationTypeFilter(Mapper.class));
        }

        @Override
        protected boolean isCandidateComponent(
                org.springframework.beans.factory.annotation.AnnotatedBeanDefinition beanDefinition) {
            return beanDefinition.getMetadata().isIndependent();
        }
    }
}
