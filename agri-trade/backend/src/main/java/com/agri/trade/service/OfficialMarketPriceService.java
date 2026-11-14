package com.agri.trade.service;

import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.util.HtmlUtils;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.*;

/** 交易域公开批发报价事实；不输出未来价格或自动交易指令。 */
@Service
public class OfficialMarketPriceService {
    public static final String INDEX = "https://fzggw.nx.gov.cn/sjfb/jcsj/";
    public static final String PROVIDER = "NX_FGW_BAIHUA_V1";
    public static final String MARKET = "石嘴山市百花批发市场";
    public static final String FUJIAN_INDEX = "https://nynct.fj.gov.cn/xxgk/tjxx/tjsj/scpfscjg/";
    public static final String FUJIAN_PROVIDER = "FJ_NYNCT_VEGETABLE_WHOLESALE_V1";
    public static final String FUJIAN_MARKET = "福建省蔬菜批发市场";
    private static final String SOURCE_NX = "NX";
    private static final String SOURCE_FUJIAN = "FUJIAN";
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).followRedirects(HttpClient.Redirect.NEVER).build();
    public OfficialMarketPriceService(JdbcTemplate db, PlatformTransactionManager manager) { this.db=db; this.tx=new TransactionTemplate(manager); }
    public record Quote(String crop, String sourceName, String specification, BigDecimal originalPrice, String originalUnit, BigDecimal priceKg, String market, String region) {}
    public record Report(LocalDate date, List<Quote> quotes, int skipped) {}
    public static String canonical(String crop) { return switch(crop.trim()) { case "番茄" -> "西红柿"; case "马铃薯" -> "土豆"; case "洋白菜", "包菜" -> "甘蓝"; default -> crop.trim(); }; }
    private static String plain(String html) { return HtmlUtils.htmlUnescape(html.replaceAll("(?is)<[^>]+>", " ")).replace('\u00a0',' ').replace('\u2002',' ').replace('\u3000',' ').trim().replaceAll("\\s+", " "); }
    private static LocalDate date(String value) {
        Matcher chinese = Pattern.compile("(20\\d{2})年(\\d{1,2})月(\\d{1,2})日").matcher(value);
        if (chinese.find()) return LocalDate.of(Integer.parseInt(chinese.group(1)), Integer.parseInt(chinese.group(2)), Integer.parseInt(chinese.group(3)));
        Matcher slash = Pattern.compile("(20\\d{2})[/-](\\d{1,2})[/-](\\d{1,2})").matcher(value);
        if (slash.find()) return LocalDate.of(Integer.parseInt(slash.group(1)), Integer.parseInt(slash.group(2)), Integer.parseInt(slash.group(3)));
        throw new IllegalArgumentException("报告缺少报价日期");
    }
    private static List<List<String>> rows(String html) {
        List<List<String>> result = new ArrayList<>();
        Matcher rows=Pattern.compile("(?is)<tr\\b[^>]*>(.*?)</tr>").matcher(html);
        while(rows.find()) {
            List<String> cells=new ArrayList<>(); Matcher cell=Pattern.compile("(?is)<t[dh]\\b[^>]*>(.*?)</t[dh]>").matcher(rows.group(1));
            while(cell.find()) cells.add(plain(cell.group(1)));
            if (!cells.isEmpty()) result.add(cells);
        }
        return result;
    }
    public static Report parse(String html) {
        Matcher title=Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html);
        if(!title.find()) throw new IllegalArgumentException("报告缺少标题");
        String name=plain(title.group(1));
        if(!name.contains(MARKET) || !name.contains("价格")) throw new IllegalArgumentException("不是配置市场的价格报告");
        LocalDate reportDate=date(name); if(reportDate.isAfter(LocalDate.now())) throw new IllegalArgumentException("不能导入未来日期报价");
        List<Quote> quotes=new ArrayList<>(); int skipped=0; boolean header=false;
        for (List<String> cells : rows(html)) {
            if(cells.size()==5 && cells.get(1).equals("品种") && cells.get(3).equals("计量单位") && cells.get(4).equals("批发价格")) {header=true;continue;}
            if(!header || cells.size()!=5 || !cells.get(0).matches("\\d+")) continue;
            String unit=cells.get(3).replace("／","/").replace(" ","");
            BigDecimal factor=switch(unit) {case "元/500克", "元/500g" -> new BigDecimal("2"); case "元/公斤", "元/kg", "元/千克" -> BigDecimal.ONE; default -> null;};
            if(factor==null || !cells.get(4).matches("[0-9]+(?:\\.[0-9]+)?")) {skipped++;continue;}
            BigDecimal price=new BigDecimal(cells.get(4));
            if(price.signum()<=0 || cells.get(1).isBlank()) {skipped++;continue;}
            quotes.add(new Quote(canonical(cells.get(1)),cells.get(1),cells.get(2),price,unit,price.multiply(factor),MARKET,"宁夏·石嘴山"));
        }
        if(!header || quotes.isEmpty()) throw new IllegalArgumentException("报告表结构变化或无有效报价，未导入");
        return new Report(reportDate,quotes,skipped);
    }
    public static Report parseFujian(String html) {
        String body=plain(html);
        if(!body.contains("福建省农业农村厅") || !body.contains("蔬菜批发市场主要品种价格")) throw new IllegalArgumentException("不是福建省农业农村厅蔬菜批发价格报告");
        LocalDate fallback=date(body); List<Quote> quotes=new ArrayList<>(); int skipped=0; boolean header=false;
        for (List<String> cells : rows(html)) {
            if(cells.size()==4 && cells.get(0).contains("批发市场") && cells.get(1).equals("品种") && cells.get(2).contains("大宗价")) {header=true;continue;}
            if(!header || cells.size()!=4) continue;
            String market=cells.get(0), crop=cells.get(1), priceText=cells.get(2).replace("\u00a0", "").trim(), dayText=cells.get(3);
            if(market.isBlank() || crop.isBlank() || !priceText.matches("[0-9]+(?:\\.[0-9]+)?")) {skipped++;continue;}
            LocalDate quoteDate; try { quoteDate=date(dayText); } catch (IllegalArgumentException e) { skipped++; continue; }
            BigDecimal price=new BigDecimal(priceText); if(price.signum()<=0) {skipped++;continue;}
            quotes.add(new Quote(canonical(crop),crop,"大宗价",price,"元/公斤",price,market,"福建"));
            fallback=quoteDate;
        }
        if(!header || quotes.isEmpty()) throw new IllegalArgumentException("福建报告表结构变化或无有效报价，未导入");
        if(fallback.isAfter(LocalDate.now())) throw new IllegalArgumentException("不能导入未来日期报价");
        return new Report(fallback,quotes,skipped);
    }
    String fetch(String url) throws Exception {
        URI uri=URI.create(url);
        boolean nx="https".equals(uri.getScheme()) && "fzggw.nx.gov.cn".equals(uri.getHost()) && uri.getUserInfo()==null && uri.getPort()==-1 && uri.getPath().startsWith("/sjfb/jcsj/");
        boolean fj="https".equals(uri.getScheme()) && "nynct.fj.gov.cn".equals(uri.getHost()) && uri.getUserInfo()==null && uri.getPort()==-1 && uri.getPath().startsWith("/xxgk/tjxx/tjsj/scpfscjg/");
        if(!nx && !fj) throw new IllegalArgumentException("仅支持配置的官方价格监测目录");
        var response=http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("User-Agent","AgriPlatform/1.0 public-price-reference").GET().build(),HttpResponse.BodyHandlers.ofInputStream());
        try(var in=response.body()) { if(response.statusCode()!=200) throw new IllegalStateException("官方来源返回 HTTP "+response.statusCode()); byte[] data=in.readNBytes(2_000_001); if(data.length>2_000_000) throw new IllegalStateException("报告超出大小限制"); return new String(data,StandardCharsets.UTF_8); }
    }
    public static String discover(String html) {
        Matcher links=Pattern.compile("(?is)<a\\b[^>]*href=['\"]([^'\"]+)['\"][^>]*>(.*?)</a>").matcher(html); String best=null; LocalDate latest=LocalDate.MIN;
        while(links.find()) { String label=plain(links.group(2)); if(!label.contains(MARKET)) continue; LocalDate d; try {d=date(label);} catch(Exception e){continue;} if(d.isAfter(LocalDate.now()) || !d.isAfter(latest)) continue; URI candidate=URI.create(INDEX).resolve(links.group(1)); if(!"fzggw.nx.gov.cn".equals(candidate.getHost()) || !candidate.getPath().startsWith("/sjfb/jcsj/")) continue; best=candidate.toString();latest=d; }
        if(best==null) throw new IllegalStateException("官方目录未找到配置市场报告"); return best;
    }
    public static String discoverFujian(String html) {
        Matcher links=Pattern.compile("(?is)<a\\b[^>]*href=['\"]([^'\"]+)['\"][^>]*>(.*?)</a>").matcher(html); String best=null; LocalDate latest=LocalDate.MIN;
        while(links.find()) {
            String label=plain(links.group(2)); if(!label.contains("蔬菜批发市场主要品种价格")) continue;
            URI candidate=URI.create(FUJIAN_INDEX).resolve(links.group(1));
            if(!Set.of("nynct.fj.gov.cn", "nynct.fujian.gov.cn").contains(candidate.getHost()) || !Set.of("http", "https").contains(candidate.getScheme()) || candidate.getUserInfo()!=null || candidate.getPort()!=-1 || !candidate.getPath().startsWith("/xxgk/tjxx/tjsj/scpfscjg/") || candidate.getQuery()!=null || candidate.getFragment()!=null) continue;
            // 官方目录仍含旧域名 HTTP 链接，统一到当前官方 HTTPS 主机后抓取。
            candidate=URI.create("https://nynct.fj.gov.cn"+candidate.getPath());
            LocalDate d; try { d=date(label); } catch(Exception e) {
                Matcher pathDate=Pattern.compile("/(20\\d{2})(\\d{2})/t(20\\d{2})(\\d{2})(\\d{2})_").matcher(candidate.getPath());
                if(!pathDate.find()) continue;
                d=LocalDate.of(Integer.parseInt(pathDate.group(3)),Integer.parseInt(pathDate.group(4)),Integer.parseInt(pathDate.group(5)));
            }
            if(d.isAfter(LocalDate.now()) || !d.isAfter(latest)) continue;
            best=candidate.toString(); latest=d;
        }
        if(best==null) throw new IllegalStateException("福建官方目录未找到蔬菜批发价格报告"); return best;
    }
    public synchronized Map<String,Object> sync(String operator) { return sync(operator, SOURCE_NX); }
    public synchronized Map<String,Object> sync(String operator, String source) {
        if (!SOURCE_NX.equalsIgnoreCase(source) && !SOURCE_FUJIAN.equalsIgnoreCase(source)) throw new IllegalArgumentException("不支持的行情来源");
        String id=UUID.randomUUID().toString(), url=SOURCE_FUJIAN.equalsIgnoreCase(source)?FUJIAN_INDEX:INDEX, provider=SOURCE_FUJIAN.equalsIgnoreCase(source)?FUJIAN_PROVIDER:PROVIDER;
        try {
            url=SOURCE_FUJIAN.equalsIgnoreCase(source)?discoverFujian(fetch(FUJIAN_INDEX)):discover(fetch(INDEX)); String html=fetch(url); String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(html.getBytes(StandardCharsets.UTF_8)));
            List<Map<String,Object>> exists=db.queryForList("SELECT id,status,report_date,parsed_count,skipped_count FROM agri_trade_official_price_batch WHERE provider=? AND content_hash=?",provider,hash);
            if(!exists.isEmpty()) {var result=new LinkedHashMap<>(exists.get(0));result.put("duplicate",true);result.put("provider",provider);return result;}
            Report report=SOURCE_FUJIAN.equalsIgnoreCase(source)?parseFujian(html):parse(html); String sourceUrl=url;
            return tx.execute(status -> { db.update("INSERT INTO agri_trade_official_price_batch(id,provider,source_url,content_hash,status,report_date,parsed_count,skipped_count,raw_html,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",id,provider,sourceUrl,hash,"SUCCESS",report.date(),report.quotes().size(),report.skipped(),html,operator,LocalDateTime.now()); for(Quote q:report.quotes()) db.update("INSERT INTO agri_trade_official_price_quote(id,batch_id,crop_name,source_name,specification,market_name,region_name,quote_date,price_kg,original_price,original_unit,source_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",UUID.randomUUID().toString(),id,q.crop(),q.sourceName(),q.specification(),q.market(),q.region(),report.date(),q.priceKg(),q.originalPrice(),q.originalUnit(),sourceUrl,LocalDateTime.now()); return Map.<String,Object>of("id",id,"status","SUCCESS","provider",provider,"reportDate",report.date().toString(),"parsedCount",report.quotes().size(),"skippedCount",report.skipped(),"sourceUrl",sourceUrl,"duplicate",false); });
        } catch(Exception e) { String message=e.getMessage()==null?"官方行情暂不可用":e.getMessage(); message=message.substring(0,Math.min(450,message.length())); db.update("INSERT INTO agri_trade_official_price_batch(id,provider,source_url,status,error_message,operator,created_at) VALUES(?,?,?,?,?,?,?)",id,provider,url,"FAILED",message,operator,LocalDateTime.now()); return Map.of("id",id,"status","FAILED","provider",provider,"error",message); }
    }
    public Map<String,Object> quotes(String crop) { if(crop==null || crop.isBlank() || crop.length()>128) throw new IllegalArgumentException("请填写有效作物名"); List<Map<String,Object>> rows=db.queryForList("SELECT * FROM agri_trade_official_price_quote WHERE crop_name=? ORDER BY quote_date DESC,created_at DESC LIMIT 60",canonical(crop)); List<Map<String,Object>> views=new ArrayList<>(); for(var row:rows) views.add(view(row)); return Map.of("quotes",views,"notice","地方批发历史报价，不是全国价、地头价或未来预测；超过7天不可引用。","provider","MULTI","market","多来源","sourceUrl",FUJIAN_INDEX); }
    public Map<String,Object> resolve(String id,String crop) { var rows=db.queryForList("SELECT * FROM agri_trade_official_price_quote WHERE id=? AND crop_name=?",id,canonical(crop)); if(rows.isEmpty()) throw new IllegalArgumentException("行情不存在或不适用于当前作物"); var result=view(rows.get(0)); if(Boolean.TRUE.equals(result.get("stale"))) throw new IllegalArgumentException("行情已超过7天或日期异常，请同步最新数据"); return result; }
    private Map<String,Object> view(Map<String,Object> row) {
        LocalDate date=LocalDate.parse(row.get("quote_date").toString());
        var view=new LinkedHashMap<String,Object>();
        view.put("id",row.get("id"));view.put("batchId",row.get("batch_id"));view.put("cropName",row.get("crop_name"));view.put("sourceName",row.get("source_name"));view.put("specification",row.get("specification"));view.put("quoteDate",date.toString());view.put("priceKg",row.get("price_kg"));view.put("unit","元/kg");view.put("market",row.get("market_name"));view.put("region",row.get("region_name"));view.put("originalPrice",row.get("original_price"));view.put("originalUnit",row.get("original_unit"));view.put("sourceUrl",row.get("source_url"));view.put("fetchedAt",row.get("created_at"));view.put("stale",date.isBefore(LocalDate.now().minusDays(7)) || date.isAfter(LocalDate.now()));view.put("kind","OBSERVED_WHOLESALE_PRICE");
        List<Map<String,Object>> batches=db.queryForList("SELECT provider FROM agri_trade_official_price_batch WHERE id=?",row.get("batch_id"));
        view.put("provider",batches.isEmpty()?null:batches.get(0).get("provider"));
        return view;
    }
    public List<Map<String,Object>> batches() {return db.queryForList("SELECT id,provider,status,report_date,parsed_count,skipped_count,source_url,error_message,operator,created_at FROM agri_trade_official_price_batch ORDER BY created_at DESC LIMIT 20");}
}
