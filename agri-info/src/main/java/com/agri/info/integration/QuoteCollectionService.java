package com.agri.info.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.InetAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** 授权 JSON 接口采集。网络请求不占用数据库事务；有效观测、行情和历史在同一事务提交。 */
@Service
public class QuoteCollectionService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final TransactionTemplate tx;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    public QuoteCollectionService(JdbcTemplate jdbc, ObjectMapper json, org.springframework.transaction.PlatformTransactionManager manager) {
        this.jdbc = jdbc; this.json = json; this.tx = new TransactionTemplate(manager);
    }
    private static String now() { return LocalDateTime.now(ZONE).format(LABEL); }
    private static String text(Map<String,Object> body, String key) {
        return Objects.toString(body.get(key), "").trim();
    }
    public Map<String,Object> config(long taskId) {
        var rows = jdbc.queryForList("SELECT task_id,endpoint,rows_path,field_map,token_env,enabled FROM info_collect_config WHERE task_id=?", taskId);
        if (rows.isEmpty()) return Map.of("endpoint", "", "rowsPath", "", "fieldMap", "{}", "tokenEnv", "", "enabled", false);
        var r = rows.get(0);
        return Map.of("endpoint", r.get("endpoint"), "rowsPath", r.get("rows_path"), "fieldMap", r.get("field_map"),
                "tokenEnv", r.get("token_env"), "enabled", r.get("enabled"));
    }
    public Map<String,Object> saveConfig(long taskId, Map<String,Object> body, String operator) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_task WHERE id=?", Integer.class, taskId) == 0)
            throw new IllegalArgumentException("采集任务不存在");
        String endpoint = text(body,"endpoint"), path = text(body,"rowsPath"), mapping = text(body,"fieldMap"), env = text(body,"tokenEnv");
        validateEndpoint(endpoint, false);
        if (endpoint.length() > 1500 || path.length() > 200 || mapping.length() > 4000 || env.length() > 120)
            throw new IllegalArgumentException("采集配置过长");
        if (!env.isEmpty() && !env.matches("[A-Z][A-Z0-9_]*")) throw new IllegalArgumentException("授权环境变量名格式不正确");
        if (!path.isEmpty() && !path.startsWith("/")) throw new IllegalArgumentException("数据路径请使用 JSON Pointer，如 /data/rows");
        try {
            JsonNode fields = json.readTree(mapping.isEmpty() ? "{}" : mapping);
            if (!fields.isObject()) throw new IllegalArgumentException("字段映射必须是 JSON 对象");
            fields.fields().forEachRemaining(e -> {
                if (!e.getValue().isTextual() || !e.getValue().asText().startsWith("/"))
                    throw new IllegalArgumentException("字段映射的值必须是 JSON Pointer");
            });
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("字段映射不是有效 JSON"); }
        String fieldMap = mapping.isEmpty() ? "{}" : mapping;
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        tx.executeWithoutResult(s -> {
            if (jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_task WHERE id=? AND status='running'", Integer.class, taskId) > 0)
                throw new IllegalArgumentException("任务执行中，请稍后修改");
            int n = jdbc.update("UPDATE info_collect_config SET endpoint=?,rows_path=?,field_map=?,token_env=?,enabled=? WHERE task_id=?", endpoint,path,fieldMap,env,enabled,taskId);
            if (n == 0) jdbc.update("INSERT INTO info_collect_config(task_id,endpoint,rows_path,field_map,token_env,enabled) VALUES(?,?,?,?,?,?)",taskId,endpoint,path,fieldMap,env,enabled);
            jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)", operator,"配置行情采集", "任务#"+taskId,"配置授权接口与字段映射；启用="+enabled);
        });
        return Map.of("message", "采集配置已保存，立即执行后查看真实结果");
    }
    private static URI validateEndpoint(String endpoint, boolean resolve) {
        try {
            URI uri = URI.create(endpoint);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null)
                throw new IllegalArgumentException("请使用不含账号、查询密钥和片段的 HTTPS 接口，授权通过环境变量 Bearer Token 提供");
            if (resolve) for (InetAddress a : InetAddress.getAllByName(uri.getHost()))
                if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress() || a.isMulticastAddress() || (a.getAddress().length == 16 && (a.getAddress()[0] & 0xfe) == 0xfc))
                    throw new IllegalArgumentException("采集接口必须指向公网授权数据服务");
            return uri;
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("采集接口地址无法解析"); }
    }
    public List<Map<String,Object>> runs(long taskId) {
        return jdbc.queryForList("SELECT id,task_id AS taskId,started_at AS startedAt,finished_at AS finishedAt,status,total_rows AS totalRows,accepted_rows AS acceptedRows,duplicate_rows AS duplicateRows,rejected_rows AS rejectedRows,detail FROM info_collect_run WHERE task_id=? ORDER BY id DESC LIMIT 20",taskId);
    }
    public Map<String,Object> run(long taskId, String operator) {
        var tasks = jdbc.queryForList("SELECT name,source_name FROM info_collect_task WHERE id=?", taskId);
        if (tasks.isEmpty()) throw new IllegalArgumentException("采集任务不存在");
        String start = now();
        int locked = jdbc.update("UPDATE info_collect_task SET status='running',last_run=?,last_rows=0,remark='正在请求授权行情接口' WHERE id=? AND (status<>'running' OR last_run<? OR last_run IS NULL)",start,taskId,LocalDateTime.now(ZONE).minusMinutes(5).format(LABEL));
        if (locked == 0) throw new IllegalArgumentException("任务正在执行，请勿重复触发");
        long begin = System.nanoTime();
        long runId = 0;
        int total=0, accepted=0, duplicates=0, rejected=0;
        String status="failed", detail="", source=Objects.toString(tasks.get(0).get("source_name"),"");
        try {
            runId = Objects.requireNonNull(tx.execute(s -> {
                jdbc.update("INSERT INTO info_collect_run(task_id,started_at,status,detail) VALUES(?,?,'running','')",taskId,start);
                return jdbc.queryForObject("SELECT MAX(id) FROM info_collect_run WHERE task_id=?",Long.class,taskId);
            }));
            var cfg = config(taskId);
            if (!Boolean.parseBoolean(Objects.toString(cfg.get("enabled")))) throw new IllegalArgumentException("尚未配置或未启用真实采集接口，请先配置授权数据源");
            URI uri = validateEndpoint(Objects.toString(cfg.get("endpoint")), true);
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("Accept","application/json");
            String env = Objects.toString(cfg.get("tokenEnv"));
            if (!env.isBlank()) {
                String token = System.getenv(env);
                if (token == null || token.isBlank()) throw new IllegalArgumentException("授权环境变量未设置");
                request.header("Authorization","Bearer "+token);
            }
            byte[] payload;
            var response = http.send(request.GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (response.statusCode()!=200) throw new IllegalArgumentException("数据源响应 HTTP "+response.statusCode()+"，未写入报价");
                payload = body.readNBytes(MAX_BYTES+1);
            }
            if(payload.length>MAX_BYTES) throw new IllegalArgumentException("响应超过2MB，请在数据源拆分采集范围");
            JsonNode root = json.readTree(payload);
            JsonNode rows = root.at(Objects.toString(cfg.get("rowsPath")));
            if (!rows.isArray() || rows.isEmpty() || rows.size()>5000) throw new IllegalArgumentException("接口必须返回1至5000条报价数组，请检查数据路径或拆分任务");
            total=rows.size();
            JsonNode mapping = json.readTree(Objects.toString(cfg.get("fieldMap")));
            List<String> errors = new ArrayList<>();
            int rowNum=0;
            for (JsonNode row : rows) {
                rowNum++;
                try { if (ingest(taskId,runId,source,row,mapping)) accepted++; else duplicates++; }
                catch (IllegalArgumentException e) { rejected++; if(errors.size()<8) errors.add("第"+rowNum+"行："+e.getMessage()); }
            }
            status = rejected==0 ? "success" : accepted+duplicates>0 ? "partial" : "failed";
            detail="接收"+total+"，入库"+accepted+"，重复"+duplicates+"，拒收"+rejected+(errors.isEmpty()?"":"；"+String.join("；",errors));
        } catch (IllegalArgumentException e) { detail=e.getMessage(); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); detail="采集被中断，已入库观测保留，请重试"; }
        catch (Exception e) { detail="采集请求或数据库处理失败（"+e.getClass().getSimpleName()+"），已入库观测保留，可安全重试"; }
        long finalRunId=runId; String finalStatus=status, finalDetail=detail.length()>1800?detail.substring(0,1800):detail;
        int t=total,a=accepted,d=duplicates,r=rejected, duration=(int)((System.nanoTime()-begin)/1000000);
        tx.executeWithoutResult(s -> {
            jdbc.update("UPDATE info_collect_task SET status=?,last_rows=?,duration_ms=?,remark=? WHERE id=?",finalStatus,a,duration,finalDetail.substring(0,Math.min(300,finalDetail.length())),taskId);
            if(finalRunId>0) jdbc.update("UPDATE info_collect_run SET finished_at=?,status=?,total_rows=?,accepted_rows=?,duplicate_rows=?,rejected_rows=?,detail=? WHERE id=?",now(),finalStatus,t,a,d,r,finalDetail,finalRunId);
            jdbc.update("UPDATE info_quote_source SET point_count=(SELECT COUNT(*) FROM info_quote WHERE source=?),error_rate=?,status=? WHERE name=?",source,t>0?BigDecimal.valueOf(r*100.0/t).setScale(2,RoundingMode.HALF_UP):new BigDecimal("100"),finalStatus,source);
            if(a+d>0) jdbc.update("UPDATE info_quote_source SET last_sync=? WHERE name=?",now(),source);
            jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",operator,"执行真实行情采集","任务#"+taskId,finalDetail.substring(0,Math.min(300,finalDetail.length())));
        });
        return Map.of("message",detail,"status",status,"accepted",accepted,"duplicates",duplicates,"rejected",rejected);
    }
    private String field(JsonNode row, JsonNode mapping, String key, int max) {
        JsonNode v = row.at(mapping.path(key).asText("/"+key));
        if (!v.isValueNode() || v.isNull() || v.asText().isBlank() || v.asText().trim().length()>max)
            throw new IllegalArgumentException(key+"缺失或长度无效");
        return v.asText().trim();
    }
    // 包级入口供隔离数据库验证；不暴露匿名写入接口。
    boolean ingest(long taskId,long runId,String source,JsonNode row,JsonNode mapping) {
        String external=field(row,mapping,"code",80),name=field(row,mapping,"name",60),category=field(row,mapping,"category",40),
                origin=field(row,mapping,"origin",80),market=field(row,mapping,"market",80),spec=field(row,mapping,"spec",200),unit=field(row,mapping,"priceUnit",20);
        BigDecimal price;
        try { price=new BigDecimal(field(row,mapping,"price",30)).setScale(2,RoundingMode.UNNECESSARY); }
        catch (ArithmeticException|NumberFormatException e) { throw new IllegalArgumentException("价格须为最多两位小数的有效数字"); }
        if(price.signum()<=0 || price.compareTo(new BigDecimal("99999999.99"))>0) throw new IllegalArgumentException("价格必须大于0且在存储范围内");
        LocalDateTime observed;
        String time=field(row,mapping,"observedAt",40);
        try { observed=OffsetDateTime.parse(time).atZoneSameInstant(ZONE).toLocalDateTime(); }
        catch(Exception e) { try { observed=LocalDateTime.parse(time.replace(' ','T')); } catch(Exception ex) { throw new IllegalArgumentException("观测时间格式无效，请提供ISO时间或北京时间"); } }
        if(observed.isAfter(LocalDateTime.now(ZONE).plusMinutes(5))) throw new IllegalArgumentException("观测时间超前");
        if(observed.isBefore(LocalDateTime.now(ZONE).minusYears(10))) throw new IllegalArgumentException("观测时间早于可接受历史范围");
        String stamp=observed.format(LABEL),date=observed.toLocalDate().toString();
        String identity;
        try { identity=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of(taskId,external,name,category,origin,market,spec,unit)))); }
        catch(Exception e){ throw new IllegalStateException(e); }
        String code="C"+identity.substring(0,39),key=identity+":"+stamp;
        Boolean result=tx.execute(s -> {
            // 同一任务在数据库中持有执行租约；同品种同时间不可静默覆盖已采集观测。
            var prior=jdbc.queryForList("SELECT price FROM info_collect_observation WHERE observation_key=?",key);
            if(!prior.isEmpty()) {
                if(((BigDecimal)prior.get(0).get("price")).compareTo(price)!=0) throw new IllegalArgumentException("同一观测时点价格冲突，需核验数据源");
                return false;
            }
            jdbc.update("INSERT INTO info_collect_observation(observation_key,task_id,run_id,quote_code,observed_at,price) VALUES(?,?,?,?,?,?)",key,taskId,runId,code,stamp,price);
            var quotes=jdbc.queryForList("SELECT id,updated_at FROM info_quote WHERE code=?",code);
            if(quotes.isEmpty()) jdbc.update("INSERT INTO info_quote(code,name,category,origin,market,price,price_unit,spec,source,status,updated_at,change_amount,change_pct,week_pct,month_pct,trend) VALUES(?,?,?,?,?,?,?,?,?,'online',?,NULL,NULL,NULL,NULL,'')",code,name,category,origin,market,price,unit,spec,source,stamp);
            long id=quotes.isEmpty()?jdbc.queryForObject("SELECT id FROM info_quote WHERE code=?",Long.class,code):((Number)quotes.get(0).get("id")).longValue();
            // 日线保留当天最新的观测；原始时点观测单独留存，不丢失日内记录。
            String latestDay=jdbc.queryForObject("SELECT MAX(observed_at) FROM info_collect_observation WHERE quote_code=? AND observed_at>=? AND observed_at<?",String.class,code,date+" 00:00:00",LocalDate.parse(date).plusDays(1)+" 00:00:00");
            if(stamp.equals(latestDay)) {
                jdbc.update("DELETE FROM info_quote_series WHERE quote_id=? AND stat_date=? AND forecast=FALSE",id,date);
                jdbc.update("INSERT INTO info_quote_series(quote_id,stat_date,price,volume,forecast) VALUES(?,?,?,NULL,FALSE)",id,date,price);
            }
            String latest=jdbc.queryForObject("SELECT MAX(observed_at) FROM info_collect_observation WHERE quote_code=?",String.class,code);
            BigDecimal latestPrice=jdbc.queryForObject("SELECT price FROM info_collect_observation WHERE quote_code=? AND observed_at=?",BigDecimal.class,code,latest);
            LocalDate current=LocalDate.parse(latest.substring(0,10));
            BigDecimal yesterday=dayPrice(id,current.minusDays(1)),week=dayPrice(id,current.minusDays(7)),month=dayPrice(id,current.minusMonths(1));
            BigDecimal change=pct(latestPrice,yesterday);
            jdbc.update("UPDATE info_quote SET price=?,updated_at=?,change_amount=?,change_pct=?,week_pct=?,month_pct=?,monitor_level=? WHERE id=?",latestPrice,latest,yesterday==null?null:latestPrice.subtract(yesterday),change,pct(latestPrice,week),pct(latestPrice,month),change!=null&&change.abs().compareTo(new BigDecimal("30"))>0?"abnormal":"normal",id);
            return true;
        });
        return Boolean.TRUE.equals(result);
    }
    private BigDecimal dayPrice(long id,LocalDate date) {
        var values=jdbc.queryForList("SELECT price FROM info_quote_series WHERE quote_id=? AND stat_date=? AND forecast=FALSE ORDER BY id DESC LIMIT 1",BigDecimal.class,id,date.toString());
        return values.isEmpty()?null:values.get(0);
    }
    private static BigDecimal pct(BigDecimal price,BigDecimal base) {
        if(base==null||base.signum()<=0) return null;
        BigDecimal result=price.subtract(base).multiply(new BigDecimal("100")).divide(base,2,RoundingMode.HALF_UP);
        return result.abs().compareTo(new BigDecimal("9999.99"))>0?null:result;
    }
}
