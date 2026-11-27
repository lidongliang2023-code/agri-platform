package com.agri.production.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** 采收班次气象约束；逐小时累计降水按供应商标记时刻的前一小时核验。 */
public final class HarvestHourlyWeatherRules {
    private HarvestHourlyWeatherRules() {}

    public static List<Map<String,Object>> normalize(JsonNode hourly) {
        List<Map<String,Object>> result=new ArrayList<>();
        if(!hourly.path("time").isArray()) return result;
        Set<String> seen=new HashSet<>();
        for(int i=0;i<hourly.path("time").size();i++) {
            LocalDateTime end;
            try {end=LocalDateTime.parse(hourly.path("time").get(i).asText());}
            catch(Exception e) {throw new IllegalArgumentException("小时预报时间无效");}
            if(end.getMinute()!=0 || end.getSecond()!=0 || !seen.add(end.toString()))
                throw new IllegalArgumentException("小时预报时间非整点或重复");
            Map<String,Object> row=new LinkedHashMap<>();
            row.put("time",end.toString()); row.put("periodStart",end.minusHours(1).toString()); row.put("periodEnd",end.toString());
            row.put("temperature",number(hourly,"temperature_2m",i));
            row.put("humidity",number(hourly,"relative_humidity_2m",i));
            row.put("rainMm",number(hourly,"precipitation",i));
            row.put("precipitationProbability",number(hourly,"precipitation_probability",i));
            row.put("windSpeedMs",number(hourly,"wind_speed_10m",i));
            row.put("windGustMs",number(hourly,"wind_gusts_10m",i));
            row.put("weatherCode",number(hourly,"weather_code",i));
            result.add(row);
        }
        result.sort(Comparator.comparing(h->String.valueOf(h.get("periodStart"))));
        return result;
    }

    public static String risk(Map<String,Object> h) {
        for(String k:List.of("temperature","humidity","rainMm","precipitationProbability","windSpeedMs","windGustMs","weatherCode")) {
            if(!(h.get(k) instanceof Number n) || !Double.isFinite(n.doubleValue())) return "逐小时预报关键字段缺失";
        }
        double rain=n(h,"rainMm"), prob=n(h,"precipitationProbability"), wind=n(h,"windSpeedMs"), gust=n(h,"windGustMs"), humidity=n(h,"humidity"), temperature=n(h,"temperature");
        int code=((Number)h.get("weatherCode")).intValue();
        if(rain<0 || prob<0 || prob>100 || wind<0 || gust<0 || humidity<0 || humidity>100 || temperature< -90 || temperature>70 || !Set.of(0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99).contains(code)) return "逐小时预报字段无效或缺失";
        if(rain>0.1 || prob>=40 || code>=51) return "小时降水或雨雪风险不可采";
        if(wind>=10.8 || gust>=10.8) return "小时大风或阵风不可采";
        return null;
    }

    public static String shiftReason(List<Map<String,Object>> hours,LocalDate date,Object rawStart,Object rawEnd) {
        LocalTime start,end;
        try {start=LocalTime.parse(Objects.toString(rawStart,""));end=LocalTime.parse(Objects.toString(rawEnd,""));}
        catch(Exception e) {return "班次时间缺失或格式错误";}
        if(!end.isAfter(start)) return "班次起止无效，跨夜班次需单独拆单";
        LocalDateTime first=date.atTime(start).truncatedTo(ChronoUnit.HOURS), finish=date.atTime(end);
        Map<String,List<Map<String,Object>>> byStart=new HashMap<>();
        for(var h:hours) byStart.computeIfAbsent(Objects.toString(h.get("periodStart"),""),k->new ArrayList<>()).add(h);
        for(LocalDateTime cursor=first;cursor.isBefore(finish);cursor=cursor.plusHours(1)) {
            List<Map<String,Object>> matches=byStart.getOrDefault(cursor.toString(),List.of());
            if(matches.size()!=1) return cursor+"：缺少连续逐小时预报或时段重复，请刷新天气";
            Map<String,Object> hour=matches.get(0);
            if(!cursor.plusHours(1).toString().equals(hour.get("periodEnd"))) return cursor+"：小时预报时段无效";
            String risk=risk(hour);
            if(risk!=null) return cursor.toLocalTime()+"–"+cursor.plusHours(1).toLocalTime()+"："+risk;
        }
        return null;
    }
    private static Double number(JsonNode root,String key,int i) {
        JsonNode array=root.path(key);
        return array.isArray() && i<array.size() && array.get(i).isNumber() && Double.isFinite(array.get(i).doubleValue()) ? array.get(i).doubleValue() : null;
    }
    private static double n(Map<String,Object> h,String key) {return ((Number)h.get(key)).doubleValue();}
}
