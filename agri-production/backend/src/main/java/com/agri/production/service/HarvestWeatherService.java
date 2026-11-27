package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.FarmMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** 采收天气规则适配层：复用生产域天气供应商与快照，不维护第二份天气主数据。 */
@Service
public class HarvestWeatherService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final FarmMapper farms;
    private final CalendarWeatherService provider;
    private final FarmIdResolver farmIds;
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    public HarvestWeatherService(JdbcTemplate db, ObjectMapper json, FarmMapper farms,
                                 CalendarWeatherService provider, FarmIdResolver farmIds) {
        this.db=db; this.json=json; this.farms=farms; this.provider=provider; this.farmIds=farmIds;
    }

    public Map<String,Object> refresh(String tenant, String farmId) {
        Farm farm = farm(tenant, farmIds.resolveFilter(farmId, tenant));
        // 供应商刷新独立提交：即使后续业务校验失败，成功/失败请求仍有留痕。
        provider.refresh(tenant, farm, today());
        return latest(tenant, farm.getId());
    }

    public Map<String,Object> latest(String tenant, Long farmId) {
        Farm farm = farm(tenant, farmId);
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("provider", "Open-Meteo"); out.put("timezone", ZONE.getId());
        out.put("latitude", farm.getLatitude()); out.put("longitude", farm.getLongitude());
        out.put("hours", List.of()); out.put("hourlyAvailable", false); out.put("days", List.of()); out.put("usable", false);
        out.put("status", "NOT_FOUND"); out.put("error", "尚未取得真实预报，请刷新真实天气");
        out.put("ruleVersion", "HARVEST-WEATHER-2-HOURLY");
        out.put("rules", "降水量>0.1mm、降水概率≥40%、雨雪天气及大风≥10.8m/s不可采；降雨后至少留1天恢复期；快照24小时有效；班次逐小时核验，阵风≥10.8m/s不可采；缺测阻止开工；默认班次07:00–16:00");
        List<Map<String,Object>> snapshots=db.queryForList("SELECT * FROM agri_prod_calendar_weather_snapshot WHERE tenant_id=? AND farm_id=? ORDER BY id DESC LIMIT 1", tenant, farmId);
        if(snapshots.isEmpty()) return out;
        Map<String,Object> row=snapshots.get(0);
        out.put("snapshotId", String.valueOf(row.get("id"))); out.put("provider", row.get("provider"));
        out.put("sourceUrl", row.get("source_url")); out.put("fetchedAt", String.valueOf(row.get("created_at")));
        out.put("status", row.get("status")); out.put("error", row.get("error_message"));
        LocalDateTime fetched=timestamp(row.get("issued_at"));
        boolean fresh=fetched!=null && !fetched.isAfter(now().plusMinutes(5)) && fetched.plusHours(24).isAfter(now());
        boolean position=same(row.get("latitude"), farm.getLatitude()) && same(row.get("longitude"), farm.getLongitude());
        if("SUCCESS".equals(row.get("status")) && !position) {out.put("status", "LOCATION_CHANGED");out.put("error", "农场坐标已变更，请刷新对应位置的真实天气");}
        else if("SUCCESS".equals(row.get("status")) && !fresh) {out.put("status", "STALE");out.put("error", "天气快照已过期，请重新获取真实预报");}
        boolean verified=position && fresh && "SUCCESS".equals(row.get("status"));
        out.put("usable", verified);
        if(fetched!=null) out.put("expiresAt", fetched.plusHours(24).toString());
        List<Map<String,Object>> source;
        try {source=json.readValue(String.valueOf(row.get("normalized_json")), new TypeReference<>(){});}
        catch(Exception e) {out.put("status", "INVALID");out.put("usable", false);out.put("error", "天气快照无法读取，请刷新");return out;}
        List<Map<String,Object>> days=new ArrayList<>();
        List<Map<String,Object>> hours=new ArrayList<>();
        for(Map<String,Object> day:source) {
            LocalDate date=LocalDate.parse(String.valueOf(day.get("date")));
            Map<String,Object> prior=source.stream().filter(d->date.minusDays(1).toString().equals(d.get("date"))).findFirst().orElse(null);
            boolean complete=day.get("precipitationMillimeters") instanceof Number && day.get("precipitationProbability") instanceof Number
                    && day.get("maxWindSpeedMs") instanceof Number && day.get("weatherCode") instanceof Number;
            boolean recovery=prior!=null && rain(prior);
            boolean priorKnown=prior!=null && prior.get("precipitationMillimeters") instanceof Number && prior.get("precipitationProbability") instanceof Number && prior.get("weatherCode") instanceof Number;
            String reason=!verified ? "预报未核验或已过期" : !complete ? "预报关键字段缺失" : rain(day) ? "降雨或雨雪天气不可采"
                    : recovery ? "雨后至少一天恢复期" : !priorKnown ? "缺少前一日天气，无法核验恢复期"
                    : Boolean.TRUE.equals(day.get("strongWind")) ? "大风不可采" : null;
            Map<String,Object> item=new LinkedHashMap<>();
            item.put("date",date.toString()); item.put("rainMm",day.get("precipitationMillimeters"));
            item.put("precipitationProbability",day.get("precipitationProbability")); item.put("maxWindSpeedMs",day.get("maxWindSpeedMs"));
            item.put("minTemperature",day.get("minTemperature")); item.put("weatherCode",day.get("weatherCode"));
            item.put("label",label(day.get("weatherCode"))); item.put("usable",reason==null);
            item.put("weatherVerified",verified && complete); item.put("note",reason==null?"可采窗口":reason);
            item.put("snapshotId",out.get("snapshotId"));
            List<Map<String,Object>> dayHours = new ArrayList<>();
            Object storedHours = day.get("hours");
            if(storedHours instanceof List<?> list) for(Object value:list) if(value instanceof Map<?,?> rawHour) {
                Map<String,Object> hour=new LinkedHashMap<>(); rawHour.forEach((k,v)->hour.put(String.valueOf(k),v));
                String risk=HarvestHourlyWeatherRules.risk(hour);
                hour.put("weatherVerified", verified && (risk == null || !risk.contains("缺失")));
                hour.put("usable",verified && risk==null);
                hour.put("note",!verified?"预报未核验或已过期":risk==null?"小时气象条件通过，仍须满足整日及恢复期规则":risk);
                hour.put("snapshotId",out.get("snapshotId")); dayHours.add(hour); hours.add(hour);
            }
            item.put("dailyUsable",reason==null);
            String shiftRisk=reason==null ? HarvestHourlyWeatherRules.shiftReason(dayHours,date,"07:00","16:00") : reason;
            item.put("usable",shiftRisk==null); item.put("hourlyCount",dayHours.size());
            item.put("defaultShiftReason",shiftRisk); item.put("note",shiftRisk==null?"可采窗口（07:00–16:00逐小时通过）":shiftRisk);
            days.add(item);
        }
        out.put("hours", hours); out.put("hourlyAvailable", !hours.isEmpty());
        out.put("hourlyStart",hours.isEmpty()?null:hours.get(0).get("periodStart"));
        out.put("hourlyEnd",hours.isEmpty()?null:hours.get(hours.size()-1).get("periodEnd"));
        out.put("days", days); return out;
    }

    public Map<String,Object> requireFresh(String tenant, Long farm) {
        Map<String,Object> weather=latest(tenant,farm);
        if(!Boolean.TRUE.equals(weather.get("usable"))) throw new BusinessException(409, Objects.toString(weather.get("error"),"请刷新真实天气"));
        return weather;
    }

    public String reason(Map<String,Object> weather, LocalDate date) {
        return shiftReason(weather,date,"07:00","16:00");
    }

    public String shiftReason(Map<String,Object> weather, LocalDate date, Object start, Object end) {
        if(date.isBefore(today())) return "日期已过，不能按预报启动新作业";
        if(!Boolean.TRUE.equals(weather.get("usable"))) return "天气未核验或快照已过期，请刷新真实天气";
        Map<String,Object> day=days(weather).stream().filter(d->date.toString().equals(d.get("date"))).findFirst().orElse(null);
        if(day==null) return "无天气预报，不能自动安排";
        if(!Boolean.TRUE.equals(day.get("dailyUsable"))) return Objects.toString(day.get("note"),"天气窗口不可用");
        return HarvestHourlyWeatherRules.shiftReason(hours(weather),date,start,end);
    }

    @SuppressWarnings("unchecked") public List<Map<String,Object>> hours(Map<String,Object> weather) {
        return (List<Map<String,Object>>)weather.getOrDefault("hours",List.of());
    }
    @SuppressWarnings("unchecked") public List<Map<String,Object>> days(Map<String,Object> weather) {
        return (List<Map<String,Object>>)weather.getOrDefault("days",List.of());
    }
    private Farm farm(String tenant, Long id) {
        Farm farm=id==null?null:farms.selectById(id);
        if(farm==null || !tenant.equals(farm.getTenantId())) throw new BusinessException(404,"农场不存在或不属于当前主体");
        return farm;
    }
    private boolean same(Object a, BigDecimal b) {try{return a!=null && b!=null && new BigDecimal(a.toString()).subtract(b).abs().compareTo(new BigDecimal("0.000001"))<=0;}catch(Exception e){return false;}}
    private LocalDateTime timestamp(Object v) {if(v instanceof java.sql.Timestamp t)return t.toLocalDateTime(); if(v instanceof LocalDateTime t)return t; try{return LocalDateTime.parse(String.valueOf(v).replace(' ','T'));}catch(Exception e){return null;}}
    private boolean rain(Map<String,Object> d) {int code=d.get("weatherCode") instanceof Number n?n.intValue():-1;return Boolean.TRUE.equals(d.get("rain")) || code>=51 && code<=99;}
    private String label(Object v) {int c=v instanceof Number n?n.intValue():-1;return c==0?"晴":c<=3&&c>=1?"多云/阴":c==45||c==48?"雾":c>=71&&c<=77||c==85||c==86?"降雪":c>=95?"雷雨":c>=51?"降水":"未知";}
    private LocalDate today(){return LocalDate.now(ZONE);}
    private LocalDateTime now(){return LocalDateTime.now(ZONE);}
}
