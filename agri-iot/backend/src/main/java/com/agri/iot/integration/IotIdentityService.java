package com.agri.iot.integration;

import com.agri.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * 物联网域的服务端身份：当前登录账号 → 生产管理租户 → 该租户可见的农场集合。
 *
 * <p><b>这一轮替换掉的写法</b>：</p>
 * <ul>
 *   <li>按 id 直读直写实体表，不看归属 —— {@code SELECT * FROM iot_device WHERE id=?}
 *       与 {@code UPDATE iot_alert SET status=? WHERE id=?}：换个数字就能读别家的遥测、
 *       替别家处置告警，甚至给别人的阀门下发控制指令；</li>
 *   <li>{@code WHERE tenant_id=1} 这种把第一个租户写死在 SQL 里的过滤 ——
 *       第二个租户永远看不到自己的告警，第一个租户却看到全平台；</li>
 *   <li>操作人写死在代码里（用户端 {@code "陈建国"}、运营端 {@code "张运营"/"李运维"}），
 *       前端还能通过 {@code handledBy} 自称任意人。</li>
 * </ul>
 *
 * <p>口径与交易/主数据/生产/金融/服务/监管各域一致：租户一律由服务端从<b>访问令牌</b>推导
 * （复用 {@link ProductionFarmClient} 走生产域的 {@code /farms/all}），解析不到就 fail-closed
 * 并写清该去找谁，绝不退化成"看全部""当它是 1 号租户"。</p>
 *
 * <p>注意租户主键口径：本域所有表的 {@code tenant_id} 都是<b>平台经营主体号</b>
 * （{@code agri_core.platform_merchant.id}），与设备注册时从生产域农场带过来的值同源。</p>
 */
@Service
public class IotIdentityService {

    private static final Logger log = LoggerFactory.getLogger(IotIdentityService.class);
    private static final String REQUEST_ATTR = IotIdentityService.class.getName() + ".context";
    private static final String AUTHORIZATION = "Authorization";

    /** 允许按租户校验的表：写死白名单，避免把外部输入拼进 SQL 表名。 */
    private static final Map<String, String> TENANT_TABLES = Map.of(
            "iot_device", "id",
            "iot_alert", "id",
            "iot_work_order", "id",
            "iot_message", "id",
            "iot_scene", "id",
            "iot_rule", "id",
            "iot_device_group", "id",
            "iot_ota_task", "id",
            "iot_alert_rule_tenant", "id");

    private final JdbcTemplate jdbc;
    private final ProductionFarmClient productionFarms;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IotIdentityService(JdbcTemplate jdbc, ProductionFarmClient productionFarms) {
        this.jdbc = jdbc;
        this.productionFarms = productionFarms;
    }

    /** 一次请求内解析出的租户与农场集合。 */
    private record Context(Long tenantId, List<Long> farmIds, List<Map<String, Object>> farms) {
    }

    /**
     * 当前账号可见的农场（生产域按令牌租户返回）。
     *
     * <p>同一个请求里会被多次调用（列表、统计、大盘），所以缓存在 request 属性上，
     * 不做跨请求缓存 —— 换主体绑定要立刻生效。</p>
     */
    public List<Map<String, Object>> currentFarms() {
        Context context = context();
        return context.farms();
    }

    /**
     * 当前租户（经营主体号）。
     *
     * @throws BusinessException 没有令牌/没有农场/农场分属多个租户时，都给出可操作的说明
     */
    public long currentTenantId() {
        Context context = context();
        if (context.tenantId() == null) {
            // 物联网侧的租户是从"当前账号可见的生产农场"上解析出来的：没有农场就没法确定主体，
            // 这种情况既可能是没绑主体，也可能是主体下还没建农场，提示要能指向下一步动作。
            throw BusinessException.forbidden(
                    "当前账号没有可见的生产农场，无法确定物联网数据的归属主体；"
                            + "请先在「生产管理」里为该账号所属的经营主体创建农场，或联系平台运营核查主体绑定");
        }
        return context.tenantId();
    }

    /**
     * 读接口用的租户：解析不到就返回 {@code null}，由调用方给出空列表。
     *
     * <p>"这个主体还没有农场"是一个正常的空数据状态，设备列表本来就是空的；
     * 如果读接口也抛 403，同一次登录下会出现"设备页空白、告警页报错"两种口径。
     * 写接口仍然用 {@link #currentTenantId()} 严格判定 —— 没主体就不许落库。</p>
     */
    public Long tenantIdOrNull() {
        return context().tenantId();
    }

    /** 当前租户的农场主键集合；为空表示没有任何可见数据（调用方应返回空列表，不是全表）。 */
    public List<Long> currentFarmIds() {
        return context().farmIds();
    }

    /** SQL 里 "farm_id IN (?,?..)" 的占位串。 */
    public String farmPlaceholders(List<Long> farmIds) {
        return String.join(",", java.util.Collections.nCopies(farmIds.size(), "?"));
    }

    /** 农场归属校验：跨租户的 farmId 直接拒，不接受前端自报。 */
    public void requireFarmAccess(Long farmId) {
        if (farmId == null) {
            throw BusinessException.validationError("请选择所属农场");
        }
        if (!currentFarmIds().contains(farmId)) {
            throw BusinessException.forbidden("农场 " + farmId + " 不属于当前经营主体，不能挂到它下面");
        }
    }

    /**
     * 按租户校验某张表的行，返回该行的关键列；不属于当前租户时按 404 处理。
     *
     * <p>刻意不区分"不存在"和"不是你的"：区分了就等于告诉调用方"这个 id 确实存在"。</p>
     */
    public Map<String, Object> requireTenantRow(String table, long id, String label) {
        String keyColumn = TENANT_TABLES.get(table);
        if (keyColumn == null) {
            throw new IllegalStateException("表 " + table + " 未登记为可按租户校验的表");
        }
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM " + table + " WHERE " + keyColumn + "=?", (rs, rowNum) -> {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    try {
                        var meta = rs.getMetaData();
                        for (int index = 1; index <= meta.getColumnCount(); index += 1) {
                            row.put(meta.getColumnLabel(index).toLowerCase(java.util.Locale.ROOT), rs.getObject(index));
                        }
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                    return row;
                }, id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound(label + "不存在：" + id);
        }
        long tenantId = currentTenantId();
        long rowTenant = longOf(rows.get(0).get("tenant_id"));
        if (rowTenant != tenantId) {
            throw BusinessException.notFound(label + "不存在：" + id);
        }
        return rows.get(0);
    }

    /**
     * 网关按农场归属校验（iot_gateway 本身没有 tenant_id，归属看 farm）。
     */
    public Map<String, Object> requireGateway(long id) {
        List<Map<String, Object>> rows = jdbc.query(
                "SELECT * FROM iot_gateway WHERE id=?", (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "farmId", rs.getLong("farm_id"),
                        "gatewayCode", String.valueOf(rs.getObject("gateway_code"))), id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("边缘网关不存在：" + id);
        }
        long farmId = longOf(rows.get(0).get("farmId"));
        if (!currentFarmIds().contains(farmId)) {
            throw BusinessException.notFound("边缘网关不存在：" + id);
        }
        return rows.get(0);
    }

    /** 遥测/控制日志这类挂在设备上的数据，先确认设备属于当前租户。 */
    public void requireDeviceAccess(long deviceId) {
        requireTenantRow("iot_device", deviceId, "设备");
    }

    /** 登录账号名：优先 nickname，其次 username；取不到就报错，不顶一个固定人名。 */
    public String operatorName() {
        String nickname = claim("nickname");
        if (nickname != null && !nickname.isBlank()) {
            return nickname;
        }
        String username = claim("username");
        if (username != null && !username.isBlank()) {
            return username;
        }
        String subject = claim("sub");
        return subject == null || subject.isBlank() ? null : subject;
    }

    /** 需要操作留痕的写接口用它：宁可失败，也不要把操作人写成"陈建国"。 */
    public String requireOperatorName() {
        String operator = operatorName();
        if (operator == null) {
            throw BusinessException.unauthorized("无法从访问令牌解析操作人，请重新登录后再试");
        }
        return operator;
    }

    /** 令牌里的 user_name / 角色声明，运营留痕里作为"以什么身份做的"。 */
    public String operatorRole() {
        String role = claim("role");
        if (role != null && !role.isBlank()) {
            return role;
        }
        List<String> roles = jdbc.queryForList(
                "SELECT DISTINCT r.code FROM agri_core.platform_user u "
                        + "JOIN agri_core.platform_user_role ur ON ur.user_id=u.id "
                        + "JOIN agri_core.platform_role r ON r.id=ur.role_id WHERE u.username=?",
                String.class, operatorName());
        return roles.isEmpty() ? null : String.join("/", roles);
    }

    /**
     * 来源 IP：网关已配 X-Real-IP / X-Forwarded-For，优先取它们，最后才退回直连地址。
     */
    public String clientIp() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return firstToken(forwarded);
        }
        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return real.trim();
        }
        return request.getRemoteAddr();
    }

    /** 给跨域调用用的原始 Authorization 头。 */
    public String currentAuthorization() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : request.getHeader(AUTHORIZATION);
    }

    private Context context() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            throw BusinessException.unauthorized("没有请求上下文，无法解析当前租户");
        }
        Object cached = request.getAttribute(REQUEST_ATTR);
        if (cached instanceof Context hit) {
            return hit;
        }
        List<Map<String, Object>> farms = productionFarms.listCurrentTenantFarms();
        List<Long> farmIds = farms.stream()
                .map(farm -> longObject(farm.get("id")))
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        List<Long> tenantIds = farms.stream()
                .map(farm -> longObject(farm.get("tenantId")))
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        if (tenantIds.size() > 1) {
            // 生产端返回的农场分属多个主体：继续按其中一个查询就是越权，必须停下来
            throw BusinessException.forbidden("当前账号可见的农场分属多个经营主体（"
                    + tenantIds + "），请联系平台运营核查主体绑定");
        }
        Context context = new Context(tenantIds.isEmpty() ? null : tenantIds.get(0), farmIds, farms);
        request.setAttribute(REQUEST_ATTR, context);
        return context;
    }

    private String claim(String key) {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return null;
        }
        String authorization = request.getHeader(AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String[] parts = authorization.substring(7).split("\\.");
        if (parts.length < 2) {
            return null;
        }
        try {
            // 只读声明用于留痕，不做信任判定：能不能进这个接口由 RBAC 与远端权限解析决定
            JsonNode value = objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1])).get(key);
            return value == null || value.isNull() ? null : value.asText();
        } catch (Exception e) {
            log.debug("解析令牌声明 {} 失败：{}", key, e.getMessage());
            return null;
        }
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private static String firstToken(String value) {
        int comma = value.indexOf(',');
        return (comma > 0 ? value.substring(0, comma) : value).trim();
    }

    private static Long longObject(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static long longOf(Object value) {
        Long parsed = longObject(value);
        return parsed == null ? -1L : parsed;
    }
}
