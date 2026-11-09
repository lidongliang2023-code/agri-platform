package com.agri.masterdata.service;

import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.mapper.PermissionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.condition.RequestMethodsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 权限点目录同步 —— 目录的唯一来源是<b>代码里真实存在的端点</b>，不是手抄清单。
 *
 * <p>为什么不让开发手写一份 SQL 种子：手抄的目录一定会漂移，而漂移后的表现是
 * "矩阵里勾了某个点，实际请求却不受它管"，这比没有权限点更坏。这里直接从
 * {@link RequestMappingHandlerMapping} 取当前应用的实际映射，逐条落库：</p>
 *
 * <ul>
 *   <li>{@code perm_code} = {@code "METHOD 路径模板"}（与鉴权拦截器算编码的方式同一处实现，见 {@link #codeOf}）；</li>
 *   <li>{@code perm_name} = 方法上的 {@code @Operation(summary)}；没有就退化成 {@code 控制器#方法名}，
 *       <b>不编中文名</b>——编出来的名字矩阵看着整齐，却没人能验证它对不对；</li>
 *   <li>{@code module} = 控制器上的 {@code @Tag(name)}，没有则用控制器类名；</li>
 *   <li>端点在代码里消失时，目录里那条置 {@code del_flag=1}（不物理删：授权历史要能追溯）。</li>
 * </ul>
 *
 * <p>可重复执行：同一端点重复同步只更新时间与名称，不会产生第二条。</p>
 */
@Service
@Slf4j
public class PermissionPointCatalogService {

    /**
     * 参与权限点登记的路径范围（目录同步与鉴权判定共用 {@link #isScoped}，两处不能各写一份）。
     *
     * <ul>
     *   <li>{@code /admin/masterdata/**}：运营端；</li>
     *   <li>{@code /api/**} 但排除下面两项：主体侧（客户、供应商、商品、系统管理…）。
     *       按钮恰恰长在这些页上 —— 只盯 {@code /api/master-data} 会漏掉 {@code /api/customer} 这类真实业务入口；
     *       而登录相关端点必须永远可达，否则一旦有人误勾就再也登不进来。</li>
     * </ul>
     *
     * <p>{@code /api/auth} 与 {@code /api/user/permission-points} 排除的理由是同一类：
     * <b>逃生通道不能被这道门锁住</b>。前者是登录，后者是「申请授权」——它存在的意义就是
     * "我被这个点拦了，所以来要权限"；一旦它自己也变成可收紧的点，矩阵上勾一下就让所有被拦的人
     * 连申请都发不出去，而且目录里也不该出现一个"没人能勾选它却又必须永远可用"的行。</p>
     */
    private static final List<String> SCOPED_PREFIXES = List.of("/admin/masterdata/", "/api/");

    private static final List<String> EXCLUDED_PREFIXES = List.of("/api/auth", "/api/user/permission-points");

    /**
     * 只登记<b>写方法</b>。
     *
     * <p>权限点要管的是"按钮"，按钮对应的是动作；GET 是读，读接口一旦能被收紧，
     * 勾中一个点就会把别人的列表页整片锁死 —— 那是事故，不是授权。
     * 所以目录里出现的每一条都能安全地"勾上即收紧"。</p>
     */
    private static final Set<RequestMethod> ACTION_METHODS = Set.of(
            RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH);

    /** 与 agri_md_permission 的列宽一致（MySQL 8 的 VARCHAR(n) 按字符计） */
    private static final int NAME_MAX = 128;
    private static final int MODULE_MAX = 64;

    private final RequestMappingHandlerMapping handlerMapping;
    private final PermissionMapper permissionMapper;

    public PermissionPointCatalogService(
            @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping handlerMapping,
            PermissionMapper permissionMapper) {
        this.handlerMapping = handlerMapping;
        this.permissionMapper = permissionMapper;
    }

    /**
     * 同步一次。
     *
     * @return scanned=扫到的映射数，created=新增点，updated=刷新点，retired=代码里已不存在的点
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> sync() {
        Map<RequestMappingInfo, HandlerMethod> mappings = handlerMapping.getHandlerMethods();
        Set<String> alive = new HashSet<>();
        int created = 0;
        int updated = 0;
        LocalDateTime now = LocalDateTime.now();

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : mappings.entrySet()) {
            HandlerMethod method = entry.getValue();
            Set<String> patterns = patternsOf(entry.getKey());
            Set<RequestMethod> verbs = verbsOf(entry.getKey()).stream()
                    .filter(ACTION_METHODS::contains).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            if (patterns.isEmpty() || verbs.isEmpty()) {
                // 读方法与未限定方法的映射都不登记：见 ACTION_METHODS 的说明
                continue;
            }
            for (String pattern : patterns) {
                if (!scoped(pattern)) {
                    continue;
                }
                for (RequestMethod verb : verbs) {
                    String code = codeOf(verb.name(), pattern);
                    alive.add(code);
                    boolean existed = upsert(code, pattern, verb.name(), method, now);
                    if (existed) {
                        updated += 1;
                    } else {
                        created += 1;
                    }
                }
            }
        }

        int retired = retireMissing(alive, now);
        log.info("权限点目录同步完成：映射 {} 个，新增 {}，刷新 {}，下线 {}",
                mappings.size(), created, updated, retired);
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("scanned", mappings.size());
        result.put("created", created);
        result.put("updated", updated);
        result.put("retired", retired);
        result.put("syncedAt", now.toString());
        return result;
    }

    /**
     * 权限点编码的唯一算法 —— 目录写入与鉴权判定都必须走这里。
     *
     * <p>两处各写一遍的话，分隔符或大小写差一点，结果就是"目录里有这个点、鉴权永远查不到"，
     * 于是那个端点看起来受权限点管，实际谁都没管住。</p>
     */
    public static String codeOf(String httpMethod, String pathPattern) {
        return httpMethod.trim().toUpperCase() + " " + pathPattern.trim();
    }

    private boolean upsert(String code, String pattern, String verb, HandlerMethod method, LocalDateTime now) {
        String name = displayName(method);
        String module = moduleName(method);
        // 含已下线的行：BaseMapper 的查询被逻辑删除过滤掉了，找不到就会 INSERT 撞 uk_perm_code 唯一键
        Permission existing = permissionMapper.selectAnyByCode(code);
        if (existing != null) {
            if (Integer.valueOf(1).equals(existing.getDelFlag())) {
                // 端点又回来了：直接改回在册。逻辑删除实体的 updateById 会附加 del_flag=0，改不动这一行。
                permissionMapper.revive(existing.getId(), name, pattern, verb, module, now);
            } else {
                existing.setPermName(name);
                existing.setModule(module);
                existing.setApiPath(pattern);
                existing.setHttpMethod(verb);
                existing.setPermType("API");
                existing.setStatus(0);
                existing.setDelFlag(0);
                existing.setUpdateTime(now);
                permissionMapper.updateById(existing);
            }
            return true;
        }
        Permission point = new Permission();
        point.setPermCode(code);
        point.setPermName(name);
        point.setPermType("API");
        point.setApiPath(pattern);
        point.setHttpMethod(verb);
        point.setModule(module);
        point.setStatus(0);
        point.setDelFlag(0);
        point.setRemark("由端点映射同步生成，不手工维护");
        point.setCreateTime(now);
        point.setUpdateTime(now);
        permissionMapper.insert(point);
        return false;
    }

    /** 代码里已经没有的端点：目录里置为下线，避免矩阵上还能勾一个不存在的动作。 */
    private int retireMissing(Set<String> alive, LocalDateTime now) {
        List<Permission> known = permissionMapper.selectList(new LambdaQueryWrapper<Permission>()
                .eq(Permission::getPermType, "API").eq(Permission::getDelFlag, 0));
        List<Long> staleIds = new ArrayList<>();
        for (Permission point : known) {
            if (!alive.contains(point.getPermCode())) {
                staleIds.add(point.getId());
            }
        }
        for (Long id : staleIds) {
            permissionMapper.retire(id, now);
        }
        return staleIds.size();
    }

    private static boolean scoped(String pattern) {
        return isScoped(pattern);
    }

    /** 路径是否在权限点作用域内（鉴权拦截器也调它，保证"登记什么"与"判什么"永远同一套）。 */
    public static boolean isScoped(String pattern) {
        if (pattern == null || pattern.isBlank()) {
            return false;
        }
        String path = pattern.trim();
        if (EXCLUDED_PREFIXES.stream().anyMatch(path::startsWith)) {
            return false;
        }
        return SCOPED_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private static String displayName(HandlerMethod method) {
        Operation operation = method.getMethodAnnotation(Operation.class);
        if (operation != null && operation.summary() != null && !operation.summary().isBlank()) {
            return clip(operation.summary().trim(), NAME_MAX);
        }
        // 退化成"控制器#方法名"：这是事实，不是编的名字
        return clip(method.getBeanType().getSimpleName() + "#" + method.getMethod().getName(), NAME_MAX);
    }

    private static String moduleName(HandlerMethod method) {
        Tag tag = method.getBeanType().getAnnotation(Tag.class);
        if (tag != null && tag.name() != null && !tag.name().isBlank()) {
            return clip(tag.name().trim(), MODULE_MAX);
        }
        return clip(method.getBeanType().getSimpleName(), MODULE_MAX);
    }

    /**
     * 按列宽截断。
     *
     * <p>名称取自开发者写的 {@code @Operation(summary)}，长度不由这一层控制；而同步是一个事务，
     * 一条超长的摘要会让整批权限点回滚、矩阵上空无一物。截断只影响显示，不影响编码判定。</p>
     */
    private static String clip(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static Set<String> patternsOf(RequestMappingInfo info) {
        Set<String> out = new LinkedHashSet<>();
        PathPatternsRequestCondition pathPatterns = info.getPathPatternsCondition();
        if (pathPatterns != null) {
            pathPatterns.getPatterns().forEach(pattern -> out.add(pattern.getPatternString()));
            return out;
        }
        if (info.getPatternsCondition() != null) {
            out.addAll(info.getPatternsCondition().getPatterns());
        }
        return out;
    }

    private static Set<RequestMethod> verbsOf(RequestMappingInfo info) {
        RequestMethodsRequestCondition condition = info.getMethodsCondition();
        Set<RequestMethod> methods = condition == null ? Set.of() : condition.getMethods();
        return methods.isEmpty() ? Set.of() : methods;
    }
}
