package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.CalendarArrangeRequest;
import com.agri.production.entity.Farm;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 真实天气供应商适配、标准化和快照留痕；不负责生成农事任务。 */
@Service
public class CalendarWeatherService {
    private static final String PROVIDER = "Open-Meteo";
    private static final String URL = "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&daily=temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code&timezone=Asia%%2FShanghai&forecast_days=16";
    private static final double WIND_LIMIT = 10.8d;
    private static final double RAIN_LIMIT = 40d;
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    public CalendarWeatherService(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }

    public Map<String, Object> refresh(String tenant, Farm farm, LocalDate weekStart) {
        if (weekStart == null) throw new BusinessException(400, "天气刷新日期不能为空");
        Fetch fetch = fetch(farm);
        persist(tenant, farm, weekStart, fetch);
        return view(farm, weekStart, fetch);
    }

    public CalendarArrangeRequest refreshInput(String tenant, Farm farm, CalendarArrangeRequest input) {
        if (input == null || input.weekStart() == null) throw new BusinessException(400, "编排周起始日期不能为空");
        Fetch fetch = fetch(farm);
        persist(tenant, farm, input.weekStart(), fetch);
        Map<String, Map<String, Object>> byDate = new LinkedHashMap<>();
        for (Map<String, Object> day : fetch.days) byDate.put(String.valueOf(day.get("date")), day);
        List<CalendarArrangeRequest.DaySupply> days = new ArrayList<>();
        for (CalendarArrangeRequest.DaySupply old : input.days() == null ? List.<CalendarArrangeRequest.DaySupply>of() : input.days()) {
            Map<String, Object> day = byDate.get(old.date() == null ? "" : old.date().toString());
            if (!fetch.ok || day == null) {
                days.add(new CalendarArrangeRequest.DaySupply(old.date(), old.people(), old.machineSlots(), false, false, false, null, old.greenhouseTemperature(), append(old.note(), fetch.error == null ? "未取得对应日期预报" : fetch.error)));
            } else {
                days.add(new CalendarArrangeRequest.DaySupply(old.date(), old.people(), old.machineSlots(), bool(day.get("rain")), bool(day.get("strongWind")), true, number(day.get("minTemperature")), old.greenhouseTemperature(), append(old.note(), String.valueOf(day.get("note")))));
            }
        }
        return new CalendarArrangeRequest(input.farmId(), input.requestId(), input.weekStart(), input.source(), fetch.ok ? LocalDateTime.now() : null, fetch.ok ? fetch.sourceUrl : "Open-Meteo（获取失败）", days, input.operations());
    }

    private Fetch fetch(Farm farm) {
        if (farm == null || farm.getLatitude() == null || farm.getLongitude() == null || !valid(farm.getLatitude(), farm.getLongitude())) return Fetch.failed("农场缺少有效经纬度，无法获取真实天气预报", null, null);
        String source = String.format(Locale.ROOT, URL, farm.getLatitude(), farm.getLongitude());
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(source)).timeout(Duration.ofSeconds(15)).header("Accept", "application/json").header("User-Agent", "Agri-Production-Calendar/1.0").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            String raw = response.body() == null ? "" : response.body();
            if (response.statusCode() < 200 || response.statusCode() >= 300) return Fetch.failed("天气服务返回 HTTP " + response.statusCode(), source, raw);
            JsonNode daily = json.readTree(raw).path("daily");
            if (!daily.isObject() || !daily.path("time").isArray()) return Fetch.failed("天气响应缺少逐日预报", source, raw);
            List<Map<String, Object>> days = new ArrayList<>();
            for (int i = 0; i < daily.path("time").size(); i++) {
                Map<String, Object> day = new LinkedHashMap<>();
                day.put("date", daily.path("time").get(i).asText());
                Double min = numberAt(daily.path("temperature_2m_min"), i), prob = numberAt(daily.path("precipitation_probability_max"), i), rain = numberAt(daily.path("precipitation_sum"), i), wind = numberAt(daily.path("wind_speed_10m_max"), i);
                day.put("minTemperature", min); day.put("precipitationProbability", prob); day.put("precipitationMillimeters", rain); day.put("maxWindSpeedMs", wind); day.put("weatherCode", intAt(daily.path("weather_code"), i));
                day.put("rain", prob != null && prob >= RAIN_LIMIT || rain != null && rain > 0.1d); day.put("strongWind", wind != null && wind >= WIND_LIMIT); day.put("weatherVerified", true);
                day.put("note", "Open-Meteo逐日预报；降雨阈值" + RAIN_LIMIT + "%，大风阈值" + WIND_LIMIT + "m/s"); days.add(day);
            }
            return days.isEmpty() ? Fetch.failed("天气服务未返回逐日预报", source, raw) : Fetch.success(source, raw, days);
        } catch (Exception e) { return Fetch.failed("天气服务暂时不可用：" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()), source, null); }
    }

    private void persist(String tenant, Farm farm, LocalDate weekStart, Fetch fetch) {
        db.update("INSERT INTO agri_prod_calendar_weather_snapshot(tenant_id,farm_id,latitude,longitude,week_start,issued_at,provider,source_url,status,raw_json,normalized_json,error_message,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", tenant, farm.getId(), farm.getLatitude(), farm.getLongitude(), weekStart, fetch.ok ? LocalDateTime.now() : null, PROVIDER, fetch.sourceUrl, fetch.ok ? "SUCCESS" : "FAILED", fetch.raw, encode(fetch.days), fetch.error, LocalDateTime.now());
    }

    private Map<String, Object> view(Farm farm, LocalDate weekStart, Fetch fetch) {
        Map<String, Object> result = new LinkedHashMap<>(); result.put("status", fetch.ok ? "SUCCESS" : "FAILED"); result.put("provider", PROVIDER); result.put("sourceUrl", fetch.sourceUrl); result.put("issuedAt", fetch.ok ? LocalDateTime.now() : null); result.put("weekStart", weekStart); result.put("latitude", farm.getLatitude()); result.put("longitude", farm.getLongitude()); result.put("days", fetch.days); result.put("error", fetch.error); return result;
    }

    private String encode(Object value) { try { return json.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); } }
    private static boolean valid(BigDecimal lat, BigDecimal lon) { return lat.doubleValue() >= -90 && lat.doubleValue() <= 90 && lon.doubleValue() >= -180 && lon.doubleValue() <= 180; }
    private static Double numberAt(JsonNode node, int i) { return node.isArray() && i < node.size() && node.get(i).isNumber() ? node.get(i).doubleValue() : null; }
    private static Integer intAt(JsonNode node, int i) { return node.isArray() && i < node.size() && node.get(i).isNumber() ? node.get(i).intValue() : null; }
    private static boolean bool(Object v) { return Boolean.TRUE.equals(v); }
    private static Double number(Object v) { return v instanceof Number n ? n.doubleValue() : null; }
    private static String append(String old, String next) { return old == null || old.isBlank() ? next : old + "；" + next; }
    private record Fetch(boolean ok, String sourceUrl, String raw, String error, List<Map<String, Object>> days) { static Fetch success(String u, String r, List<Map<String, Object>> d) { return new Fetch(true, u, r, null, d); } static Fetch failed(String e, String u, String r) { return new Fetch(false, u, r, e, List.of()); } }
}
