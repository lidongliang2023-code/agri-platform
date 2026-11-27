package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * 采收域劳务人员库：只维护临时/季节性劳务人员与可到岗能力。
 * 长期组织成员、角色权限、农事任务执行人和工资结算由其它领域负责。
 */
@Service
public class LaborWorkerService {
    private static final Set<String> SOURCE_TYPES = Set.of("VILLAGE", "NEIGHBORING", "AGENCY", "OTHER");
    private static final Set<String> SKILL_TYPES = Set.of("HARVEST", "MACHINE", "DRIVER", "MIXED");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "INACTIVE");
    private final JdbcTemplate db;
    private final FarmIdResolver farmIdResolver;

    public LaborWorkerService(JdbcTemplate db, FarmIdResolver farmIdResolver) {
        this.db = db;
        this.farmIdResolver = farmIdResolver;
    }

    public PageResult<Map<String, Object>> page(String tenant, String farmId, int pageNum, int pageSize,
                                                 String keyword, String sourceType, String skillType, String status) {
        Long farm = farmIdResolver.resolveFilter(farmId, tenant);
        if (farm == null) throw new BusinessException(400, "劳务人员库必须指定当前农场");
        int p = Math.max(1, pageNum), s = Math.min(100, Math.max(1, pageSize));
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE tenant_id=? AND farm_id=?");
        args.add(tenant); args.add(farm);
        if (keyword != null && !keyword.isBlank()) {
            where.append(" AND (worker_name LIKE ? OR worker_no LIKE ? OR phone LIKE ? OR source_name LIKE ?)");
            String kw = "%" + keyword.trim() + "%";
            args.add(kw); args.add(kw); args.add(kw); args.add(kw);
        }
        if (valid(sourceType, SOURCE_TYPES)) { where.append(" AND source_type=?"); args.add(sourceType); }
        if (valid(skillType, SKILL_TYPES)) { where.append(" AND skill_type=?"); args.add(skillType); }
        if (valid(status, STATUSES)) { where.append(" AND status=?"); args.add(status); }
        long total = db.queryForObject("SELECT COUNT(*) FROM agri_prod_labor_worker" + where, Long.class, args.toArray());
        String sql = "SELECT id,worker_no workerNo,worker_name workerName,phone,source_type sourceType,source_name sourceName," +
                "skill_type skillType,daily_wage dailyWage,availability_rate availabilityRate,daily_capacity dailyCapacity," +
                "max_hours maxHours,available_weekdays availableWeekdays,available_from availableFrom,available_to availableTo," +
                "status,note,created_at createdAt,updated_at updatedAt FROM agri_prod_labor_worker" + where +
                " ORDER BY status DESC,source_type,worker_name LIMIT ? OFFSET ?";
        args.add(s); args.add((p - 1) * s);
        return PageResult.of(db.queryForList(sql, args.toArray()), total, p, s);
    }

    public Map<String, Object> summary(String tenant, String farmId, String dateText) {
        Long farm = farmIdResolver.resolveFilter(farmId, tenant);
        if (farm == null) throw new BusinessException(400, "劳务人员库必须指定当前农场");
        LocalDate date = parseDate(dateText, "统计日期");
        List<Map<String, Object>> rows = db.queryForList("SELECT source_type sourceType,status,availability_rate availabilityRate,daily_capacity dailyCapacity,daily_wage dailyWage,available_weekdays availableWeekdays,available_from availableFrom,available_to availableTo FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=?", tenant, farm);
        int active = 0, available = 0, village = 0, neighboring = 0;
        BigDecimal wageTotal = BigDecimal.ZERO;
        for (Map<String, Object> row : rows) {
            if (!"ACTIVE".equals(String.valueOf(row.get("status")))) continue;
            active++;
            if (!isAvailable(row, date)) continue;
            int capacity = (int) number(row.get("dailyCapacity"), 1d);
            int expected = (int) Math.floor(capacity * number(row.get("availabilityRate"), 100d) / 100d);
            if (expected > 0) {
                available += expected;
                if ("VILLAGE".equals(String.valueOf(row.get("sourceType")))) village += expected;
                if ("NEIGHBORING".equals(String.valueOf(row.get("sourceType")))) neighboring += expected;
                wageTotal = wageTotal.add(BigDecimal.valueOf(number(row.get("dailyWage"), 0d)));
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", date.toString());
        result.put("activeCount", active);
        result.put("availableCount", available);
        result.put("villageAvailable", village);
        result.put("neighboringAvailable", neighboring);
        result.put("averageDailyWage", available == 0 ? 0 : wageTotal.divide(BigDecimal.valueOf(available), 2, RoundingMode.HALF_UP));
        result.put("source", "LABOR_WORKER_LIBRARY");
        return result;
    }

    @Transactional
    public String create(String tenant, Map<String, Object> request, String operator) {
        Long farm = resolveFarm(tenant, request);
        Map<String, Object> v = request == null ? Map.of() : request;
        String workerNo = required(v, "workerNo", 64), name = required(v, "workerName", 64);
        String source = enumValue(v.get("sourceType"), SOURCE_TYPES, "sourceType", "VILLAGE");
        String skill = enumValue(v.get("skillType"), SKILL_TYPES, "skillType", "HARVEST");
        String status = enumValue(v.get("status"), STATUSES, "status", "ACTIVE");
        ensureUnique(tenant, farm, workerNo, null);
        LocalDateTime now = LocalDateTime.now();
        String id = UUID.randomUUID().toString();
        BigDecimal dailyWage = boundedDecimal(v.get("dailyWage"), 180, "dailyWage", 0, 100000);
        BigDecimal availabilityRate = boundedDecimal(v.get("availabilityRate"), 100, "availabilityRate", 0, 100);
        int dailyCapacity = integer(v.get("dailyCapacity"), 1);
        BigDecimal maxHours = boundedDecimal(v.get("maxHours"), 8, "maxHours", 1, 24);
        db.update("INSERT INTO agri_prod_labor_worker(id,tenant_id,farm_id,worker_no,worker_name,phone,source_type,source_name,skill_type,daily_wage,availability_rate,daily_capacity,max_hours,available_weekdays,available_from,available_to,status,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?)",
                id, tenant, farm, workerNo, name, optional(v.get("phone"), 32), source, optional(v.get("sourceName"), 128), skill,
                dailyWage, availabilityRate, dailyCapacity, maxHours,
                weekdays(v.get("availableWeekdays")), date(v.get("availableFrom")), date(v.get("availableTo")), status, optional(v.get("note"), 500), operator, now, now);
        return id;
    }

    @Transactional
    public Map<String, Object> update(String tenant, String id, Map<String, Object> request) {
        Map<String, Object> old = find(tenant, id);
        if (request == null || request.isEmpty()) throw new BusinessException(400, "请求体不能为空");
        String farmId = String.valueOf(old.get("farm_id"));
        if (request.containsKey("workerNo")) {
            String no = required(request, "workerNo", 64); ensureUnique(tenant, Long.valueOf(farmId), no, id);
        }
        String workerNo = request.containsKey("workerNo") ? required(request, "workerNo", 64) : String.valueOf(old.get("worker_no"));
        String workerName = request.containsKey("workerName") ? required(request, "workerName", 64) : String.valueOf(old.get("worker_name"));
        String source = request.containsKey("sourceType") ? enumValue(request.get("sourceType"), SOURCE_TYPES, "sourceType", null) : String.valueOf(old.get("source_type"));
        String skill = request.containsKey("skillType") ? enumValue(request.get("skillType"), SKILL_TYPES, "skillType", null) : String.valueOf(old.get("skill_type"));
        String status = request.containsKey("status") ? enumValue(request.get("status"), STATUSES, "status", null) : String.valueOf(old.get("status"));
        BigDecimal dailyWage = request.containsKey("dailyWage") ? boundedDecimal(request.get("dailyWage"), 180, "dailyWage", 0, 100000) : new BigDecimal(String.valueOf(old.get("daily_wage")));
        BigDecimal availabilityRate = request.containsKey("availabilityRate") ? boundedDecimal(request.get("availabilityRate"), 100, "availabilityRate", 0, 100) : new BigDecimal(String.valueOf(old.get("availability_rate")));
        int dailyCapacity = request.containsKey("dailyCapacity") ? integer(request.get("dailyCapacity"), 1) : Integer.parseInt(String.valueOf(old.get("daily_capacity")));
        BigDecimal maxHours = request.containsKey("maxHours") ? boundedDecimal(request.get("maxHours"), 8, "maxHours", 1, 24) : new BigDecimal(String.valueOf(old.get("max_hours")));
        db.update("UPDATE agri_prod_labor_worker SET worker_no=?,worker_name=?,phone=?,source_type=?,source_name=?,skill_type=?,daily_wage=?,availability_rate=?,daily_capacity=?,max_hours=?,available_weekdays=?,available_from=?,available_to=?,status=?,note=?,updated_at=? WHERE tenant_id=? AND id=?",
                workerNo, workerName, request.containsKey("phone") ? optional(request.get("phone"), 32) : old.get("phone"),
                source, request.containsKey("sourceName") ? optional(request.get("sourceName"), 128) : old.get("source_name"), skill,
                dailyWage, availabilityRate, dailyCapacity, maxHours,
                request.containsKey("availableWeekdays") ? weekdays(request.get("availableWeekdays")) : old.get("available_weekdays"),
                request.containsKey("availableFrom") ? date(request.get("availableFrom")) : old.get("available_from"),
                request.containsKey("availableTo") ? date(request.get("availableTo")) : old.get("available_to"), status,
                request.containsKey("note") ? optional(request.get("note"), 500) : old.get("note"), LocalDateTime.now(), tenant, id);
        return detail(tenant, id);
    }

    @Transactional
    public void delete(String tenant, String id) {
        find(tenant, id);
        db.update("DELETE FROM agri_prod_labor_worker WHERE tenant_id=? AND id=?", tenant, id);
    }

    public Map<String, Object> detail(String tenant, String id) {
        Map<String, Object> row = find(tenant, id);
        Map<String, Object> result = new LinkedHashMap<>();
        row.forEach((key, value) -> {
            StringBuilder camel = new StringBuilder();
            boolean upper = false;
            for (char c : key.toCharArray()) {
                if (c == '_') {
                    upper = true;
                } else {
                    camel.append(upper ? Character.toUpperCase(c) : c);
                    upper = false;
                }
            }
            result.put(camel.toString(), value);
        });
        return result;
    }

    private Long resolveFarm(String tenant, Map<String, Object> request) {
        if (request == null || request.get("farmId") == null) throw new BusinessException(400, "缺少 farmId");
        Long farm = farmIdResolver.resolveFilter(String.valueOf(request.get("farmId")), tenant);
        if (farm == null) throw new BusinessException(400, "farmId 无效");
        return farm;
    }

    private Map<String, Object> find(String tenant, String id) {
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM agri_prod_labor_worker WHERE tenant_id=? AND id=?", tenant, id);
        if (rows.isEmpty()) throw new BusinessException(404, "劳务人员不存在");
        return rows.get(0);
    }

    private void ensureUnique(String tenant, Long farm, String workerNo, String id) {
        String sql = "SELECT COUNT(*) FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? AND worker_no=?";
        List<Object> args = new ArrayList<>(List.of(tenant, farm, workerNo));
        if (id != null) { sql += " AND id<>?"; args.add(id); }
        if (db.queryForObject(sql, Long.class, args.toArray()) > 0) throw new BusinessException(400, "劳务编号已存在：" + workerNo);
    }

    private boolean isAvailable(Map<String, Object> row, LocalDate date) {
        String weekdays = String.valueOf(row.getOrDefault("availableWeekdays", "1,2,3,4,5,6,7"));
        int day = date.getDayOfWeek().getValue();
        if (!Arrays.asList(weekdays.split(",")).contains(String.valueOf(day))) return false;
        LocalDate from = date(row.get("availableFrom")), to = date(row.get("availableTo"));
        return (from == null || !date.isBefore(from)) && (to == null || !date.isAfter(to));
    }

    private boolean valid(String value, Set<String> values) { return value != null && values.contains(value.toUpperCase()); }
    private String required(Map<String, Object> map, String key, int max) { String value = optional(map.get(key), max); if (value == null) throw new BusinessException(400, key + "为必填"); return value; }
    private String optional(Object value, int max) { if (value == null) return null; String s = String.valueOf(value).trim(); if (s.isBlank()) return null; if (s.length() > max) throw new BusinessException(400, "字段长度不能超过" + max + "字"); return s; }
    private String enumValue(Object value, Set<String> values, String field, String fallback) { String s = value == null ? fallback : String.valueOf(value).trim().toUpperCase(); if (s == null || !values.contains(s)) throw new BusinessException(400, field + "取值不合法"); return s; }
    private String weekdays(Object value) { String s = value == null ? "1,2,3,4,5,6,7" : String.valueOf(value); if (!s.matches("[1-7](,[1-7]){0,6}")) throw new BusinessException(400, "availableWeekdays 格式不合法"); return s; }
    private int integer(Object value, int fallback) { try { int n = value == null ? fallback : Integer.parseInt(String.valueOf(value)); if (n < 1 || n > 100) throw new Exception(); return n; } catch (Exception e) { throw new BusinessException(400, "dailyCapacity 应为 1 至 100 的整数"); } }
    private BigDecimal decimal(Object value, double fallback) { try { BigDecimal n = value == null ? BigDecimal.valueOf(fallback) : new BigDecimal(String.valueOf(value)); if (n.signum() < 0) throw new Exception(); return n.setScale(2, RoundingMode.HALF_UP); } catch (Exception e) { throw new BusinessException(400, "数值字段不能为负数"); } }
    private BigDecimal boundedDecimal(Object value, double fallback, String field, double min, double max) {
        BigDecimal number = decimal(value, fallback);
        if (number.compareTo(BigDecimal.valueOf(min)) < 0 || number.compareTo(BigDecimal.valueOf(max)) > 0) {
            throw new BusinessException(400, field + "应在 " + min + " 至 " + max + " 之间");
        }
        return number;
    }
    private double number(Object value, double fallback) { try { return value == null ? fallback : Double.parseDouble(String.valueOf(value)); } catch (Exception e) { return fallback; } }
    private LocalDate date(Object value) { if (value == null || String.valueOf(value).isBlank()) return null; if (value instanceof LocalDate d) return d; try { return LocalDate.parse(String.valueOf(value).substring(0, 10)); } catch (Exception e) { throw new BusinessException(400, "日期格式应为 yyyy-MM-dd"); } }
    private LocalDate parseDate(String text, String field) { try { return text == null || text.isBlank() ? LocalDate.now() : LocalDate.parse(text); } catch (DateTimeParseException e) { throw new BusinessException(400, field + "格式应为 yyyy-MM-dd"); } }
}
