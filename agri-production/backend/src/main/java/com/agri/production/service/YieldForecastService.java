package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 产量预测与销售建议领域服务。
 * 预测只生成可追溯快照；采收、库存和交易订单仍由各自领域维护。
 */
@Service
public class YieldForecastService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final YieldMarketPriceClient market;

    public YieldForecastService(JdbcTemplate db, ObjectMapper json, YieldMarketPriceClient market) {
        this.db = db;
        this.json = json;
        this.market = market;
    }

    public Map<String, Object> list(String tenant, int pageNum, int pageSize, String status) {
        int page = Math.max(1, pageNum);
        int size = Math.min(100, Math.max(1, pageSize));
        String condition = status == null || status.isBlank() ? "" : " AND status=?";
        Object[] args = status == null || status.isBlank()
                ? new Object[]{tenant, size, (page - 1) * size}
                : new Object[]{tenant, status, size, (page - 1) * size};
        String sql = "SELECT id,farm_id,plot_id,crop_name,crop_variety,forecast_date,harvest_start,harvest_end,data_cutoff,valid_until,status,source_version,created_by,created_at "
                + "FROM agri_prod_yield_forecast WHERE tenant_id=?" + condition + " ORDER BY forecast_date DESC,created_at DESC LIMIT ? OFFSET ?";
        List<Map<String, Object>> rows = db.queryForList(sql, args);
        String countSql = "SELECT COUNT(*) FROM agri_prod_yield_forecast WHERE tenant_id=?" + condition;
        Object[] countArgs = status == null || status.isBlank() ? new Object[]{tenant} : new Object[]{tenant, status};
        Number total = db.queryForObject(countSql, Number.class, countArgs);
        return Map.of("list", rows, "total", total == null ? 0 : total.longValue(), "pageNum", page, "pageSize", size,
                "pages", (int) Math.ceil((total == null ? 0 : total.doubleValue()) / size));
    }

    public Map<String, Object> detail(String tenant, String id) {
        Map<String, Object> row = one(tenant, id);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", row.get("id"));
        view.put("farmId", row.get("farm_id"));
        view.put("plotId", row.get("plot_id"));
        view.put("cropName", row.get("crop_name"));
        view.put("cropVariety", row.get("crop_variety"));
        view.put("forecastDate", row.get("forecast_date"));
        view.put("harvestStart", row.get("harvest_start"));
        view.put("harvestEnd", row.get("harvest_end"));
        view.put("dataCutoff", row.get("data_cutoff"));
        view.put("validUntil", row.get("valid_until"));
        view.put("status", row.get("status"));
        view.put("sourceVersion", row.get("source_version"));
        view.put("input", readJson(row.get("input_json"), Map.of()));
        view.put("result", readJson(row.get("result_json"), Map.of()));
        view.put("feedback", db.queryForList("SELECT actual_quantity actualQuantity,unit,actual_date actualDate,note,created_by createdBy,created_at createdAt FROM agri_prod_yield_forecast_feedback WHERE tenant_id=? AND forecast_id=? ORDER BY id DESC", tenant, id));
        view.put("events", db.queryForList("SELECT event_type type,payload_json payload,operator,created_at createdAt FROM agri_prod_yield_forecast_event WHERE tenant_id=? AND forecast_id=? ORDER BY id", tenant, id));
        return view;
    }

    @Transactional
    public Map<String, Object> infer(String tenant, Map<String, Object> request, String operator) {
        String crop = text(request.get("cropName"));
        if (crop.isBlank()) throw new BusinessException(400, "作物不能为空");
        LocalDate today = LocalDate.now();
        LocalDate forecastDate = date(request.get("forecastDate"), today);
        LocalDate harvestStart = date(request.get("harvestStart"), forecastDate.plusDays(14));
        LocalDate harvestEnd = date(request.get("harvestEnd"), harvestStart.plusDays(21));
        if (harvestEnd.isBefore(harvestStart)) throw new BusinessException(400, "采收结束日期不能早于开始日期");
        LocalDate cutoff = date(request.get("dataCutoff"), today);
        LocalDate validUntil = cutoff.plusDays(7);
        BigDecimal areaMu = decimal(request.get("areaMu"), BigDecimal.ZERO);
        BigDecimal historyYield = decimal(request.get("historyYield"), BigDecimal.ZERO);
        BigDecimal ndvi = decimal(request.get("ndviScore"), BigDecimal.ONE).max(BigDecimal.ZERO).min(new BigDecimal("1.2"));
        BigDecimal weatherFactor = decimal(request.get("weatherFactor"), BigDecimal.ONE).max(new BigDecimal("0.7")).min(new BigDecimal("1.2"));
        BigDecimal defaultYield = historyYield.compareTo(BigDecimal.ZERO) > 0 ? historyYield : decimal(request.get("expectedYieldPerMu"), BigDecimal.ZERO);
        if (areaMu.compareTo(BigDecimal.ZERO) <= 0 || defaultYield.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "请提供有效的种植面积和历史/基准亩产；缺少依据时不生成固定演示产量");
        }
        BigDecimal predictedPerMu = defaultYield.multiply(ndvi).multiply(weatherFactor).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = predictedPerMu.multiply(areaMu).setScale(2, RoundingMode.HALF_UP);
        BigDecimal error = forecastDate.plusDays(30).isBefore(harvestStart) ? new BigDecimal("18.6") : new BigDecimal("9.4");
        boolean early = cutoff.plusDays(30).isAfter(harvestStart);
        BigDecimal lower = total.multiply(BigDecimal.ONE.subtract(error.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
        BigDecimal upper = total.multiply(BigDecimal.ONE.add(error.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
        // 行情只接受服务端解析的报价引用，客户端价格不能冒充已核验行情。
        String quoteId = text(request.get("marketQuoteId"));
        Map<String,Object> priceEvidence = quoteId.isBlank() ? Map.of() : market.resolve(quoteId, crop);
        String priceLow = priceEvidence.isEmpty() ? "未引用真实行情" : text(priceEvidence.get("priceKg"));
        String priceHigh = priceLow;
        List<Map<String, Object>> shipments = shipmentAdvice(harvestStart, total, request);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("predictedPerMu", predictedPerMu);
        result.put("predictedTotal", total);
        result.put("lowerTotal", lower);
        result.put("upperTotal", upper);
        result.put("errorPercent", error);
        result.put("earlyReferenceOnly", early);
        result.put("harvestStart", harvestStart.toString());
        result.put("harvestEnd", harvestEnd.toString());
        result.put("priceLow", priceLow);
        result.put("priceHigh", priceHigh);
        result.put("shipments", shipments);
        result.put("marketEvidence", priceEvidence);
        result.put("priceKind", priceEvidence.isEmpty() ? "UNAVAILABLE" : "OBSERVED_WHOLESALE_PRICE");
        result.put("priceNotice", "所示价格是指定市场历史批发报价，不是未来价格预测或地头收购价；出货节奏仅供参考，不基于未经验证的价格走势。");
        result.put("notice", early ? "早期预估，仅供参考；采收前30天内会随新数据收敛。" : "建议结合实际长势、行情和采后能力自主决策。");
        result.put("conflictDisclosure", "销售建议不替代农户自主决策，也不直接创建交易订单。");
        Map<String, Object> input = new LinkedHashMap<>(request);
        input.put("dataCutoff", cutoff.toString());
        input.remove("priceLow"); input.remove("priceHigh");
        input.put("marketEvidence", priceEvidence);
        input.put("source", "USER_CONFIRMED_INPUT_WITH_MARKET_V2");
        String id = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        db.update("INSERT INTO agri_prod_yield_forecast(id,tenant_id,farm_id,plot_id,crop_name,crop_variety,forecast_date,harvest_start,harvest_end,data_cutoff,valid_until,status,source_version,input_json,result_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, tenant, longValue(request.get("farmId")), longValue(request.get("plotId")), crop, text(request.get("cropVariety")), forecastDate, harvestStart, harvestEnd, cutoff, validUntil,
                "ACTIVE", "YIELD_RULE_V1", write(input), write(result), operator, now, now);
        event(tenant, id, "INFERRED", Map.of("sourceVersion", "YIELD_RULE_V1", "dataCutoff", cutoff.toString(), "earlyReferenceOnly", early), operator);
        return detail(tenant, id);
    }

    @Transactional
    public Map<String, Object> feedback(String tenant, String id, Map<String, Object> request, String operator) {
        Map<String, Object> row = one(tenant, id);
        BigDecimal quantity = decimal(request.get("actualQuantity"), BigDecimal.ZERO);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) throw new BusinessException(400, "实际采收量必须大于 0");
        LocalDate actualDate = date(request.get("actualDate"), LocalDate.now());
        db.update("INSERT INTO agri_prod_yield_forecast_feedback(forecast_id,tenant_id,actual_quantity,unit,actual_date,note,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)",
                id, tenant, quantity, textOr(request.get("unit"), "吨"), actualDate, text(request.get("note")), operator, LocalDateTime.now());
        Map<String, Object> result = readJson(row.get("result_json"), new LinkedHashMap<>());
        BigDecimal predicted = decimal(result.get("predictedTotal"), BigDecimal.ZERO);
        BigDecimal error = predicted.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO : quantity.subtract(predicted).divide(predicted, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        event(tenant, id, "FEEDBACK", Map.of("actualQuantity", quantity, "actualDate", actualDate.toString(), "deviationPercent", error), operator);
        return detail(tenant, id);
    }

    @Transactional
    public Map<String, Object> invalidate(String tenant, String id, Map<String, Object> request, String operator) {
        one(tenant, id);
        db.update("UPDATE agri_prod_yield_forecast SET status='EXPIRED',updated_at=? WHERE tenant_id=? AND id=? AND status='ACTIVE'", LocalDateTime.now(), tenant, id);
        event(tenant, id, "INVALIDATED", Map.of("reason", textOr(request.get("reason"), "数据已过期")), operator);
        return detail(tenant, id);
    }

    private List<Map<String, Object>> shipmentAdvice(LocalDate start, BigDecimal total, Map<String, Object> request) {
        List<Map<String, Object>> list = new ArrayList<>();
        int batches = Math.max(1, Math.min(4, intValue(request.get("shipmentBatches"), 2)));
        LocalDate end = date(request.get("harvestEnd"), start.plusDays(21));
        long span = java.time.temporal.ChronoUnit.DAYS.between(start,end);
        BigDecimal allocated = BigDecimal.ZERO;
        BigDecimal equalRatio = BigDecimal.ONE.divide(BigDecimal.valueOf(batches),6,RoundingMode.DOWN);
        for (int i = 0; i < batches; i++) {
            BigDecimal ratio = i == batches-1 ? BigDecimal.ONE.subtract(equalRatio.multiply(BigDecimal.valueOf(batches-1))) : equalRatio;
            BigDecimal quantity = i == batches-1 ? total.subtract(allocated) : total.multiply(ratio).setScale(2,RoundingMode.DOWN);
            allocated = allocated.add(quantity);
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("sequence",i+1);item.put("ratio",ratio);item.put("quantity",quantity);
            item.put("suggestedDate",start.plusDays(batches==1?0:span*i/(batches-1)).toString());
            item.put("reason","按用户选择的批次在采收窗口内均分，尚未建立未来行情预测及损耗优化模型");
            list.add(item);
        }
        return list;
    }

    private Map<String, Object> one(String tenant, String id) {
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM agri_prod_yield_forecast WHERE tenant_id=? AND id=?", tenant, id);
        if (rows.isEmpty()) throw new BusinessException(404, "产量预测记录不存在或不属于当前经营主体");
        return rows.get(0);
    }

    private void event(String tenant, String id, String type, Object payload, String operator) {
        db.update("INSERT INTO agri_prod_yield_forecast_event(forecast_id,tenant_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)", id, tenant, type, write(payload), operator, LocalDateTime.now());
    }
    private String write(Object value) { try { return json.writeValueAsString(value); } catch (Exception e) { throw new BusinessException(500, "预测快照序列化失败"); } }
    private <T> T readJson(Object value, T fallback) { try { return value == null ? fallback : json.readValue(String.valueOf(value), new TypeReference<T>() {}); } catch (Exception e) { return fallback; } }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static String textOr(Object value, String fallback) { String v = text(value); return v.isBlank() ? fallback : v; }
    private static LocalDate date(Object value, LocalDate fallback) { try { return value == null || text(value).isBlank() ? fallback : LocalDate.parse(text(value).substring(0, 10)); } catch (Exception e) { throw new BusinessException(400, "日期格式无效，应为 YYYY-MM-DD"); } }
    private static BigDecimal decimal(Object value, BigDecimal fallback) { try { return value == null || text(value).isBlank() ? fallback : new BigDecimal(text(value)); } catch (Exception e) { throw new BusinessException(400, "数值格式无效"); } }
    private static Long longValue(Object value) { try { return value == null || text(value).isBlank() ? null : Long.valueOf(text(value)); } catch (Exception e) { return null; } }
    private static int intValue(Object value, int fallback) { try { return value == null || text(value).isBlank() ? fallback : Integer.parseInt(text(value)); } catch (Exception e) { return fallback; } }
}
