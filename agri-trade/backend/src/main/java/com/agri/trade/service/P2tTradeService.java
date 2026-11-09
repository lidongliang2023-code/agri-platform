package com.agri.trade.service;

import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.P2tRuleConfig;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.feign.ProductionFeignClient;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.mapper.P2tRuleConfigMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 产销对接（交易侧）服务。
 *
 * <p><b>领域边界（2026-11-03 纠正）</b>：对接是**两个经营主体之间**的事——
 * 生产主体在农业生产域发布供给意向，<b>供应商主体（卖家）自己承接</b>：认领意向、以自己的主体号建品定价。
 * 平台运营方不再做这件事（原先 {@code /api/trade/admin/p2t} 的审核与建品已下线），
 * 平台只保留对账、差异处置与规则配置这类治理动作。</p>
 *
 * <p>所有跨域调用都**原样转发调用方的 Authorization**：生产端按令牌解析主体租户，
 * 用服务账号会抹平租户隔离。</p>
 */
@Slf4j
@Service
public class P2tTradeService {

    private final ProductionFeignClient production;
    private final TradeProductMapper productMapper;
    private final TradeProductCategoryMapper categoryMapper;
    private final TradeOrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final P2tRuleConfigMapper ruleMapper;
    private final PlatformIdentityService identityService;

    /** 生产端服务间通道密钥（与 agri-production 配置一致） */
    @Value("${p2t.trade-channel-token:}")
    private String channelToken;

    public P2tTradeService(ProductionFeignClient production,
                           TradeProductMapper productMapper,
                           TradeProductCategoryMapper categoryMapper,
                           TradeOrderMapper orderMapper,
                           OrderItemMapper orderItemMapper,
                           P2tRuleConfigMapper ruleMapper,
                           PlatformIdentityService identityService) {
        this.production = production;
        this.productMapper = productMapper;
        this.categoryMapper = categoryMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.ruleMapper = ruleMapper;
        this.identityService = identityService;
    }

    /* ==================== 供给意向池 / 供应商承接 ==================== */

    /** 生产端发来的原始意向分页（跨主体，靠服务通道密钥放行）。 */
    private Map<String, Object> rawPool(int pageNum, int pageSize, String keyword, String auditStatus) {
        Map<String, Object> res = production.p2tPool(auth(), channel(), safePage(pageNum), safeSize(pageSize),
                blankToNull(keyword), blankToNull(auditStatus));
        return dataOf(res);
    }

    public Map<String, Object> offer(String offerNo) {
        return dataOf(production.p2tOffer(auth(), channel(), offerNo));
    }

    /**
     * 供应商可见的意向池：生产端意向 + 本域实查出来的承接状态。
     *
     * <p>承接关系不另建表：{@code agri_trade_product.source_offer_no} 非空且未删就是认领凭证，
     * 商品上的 {@code seller_id} 说明是谁认领的。两处都从交易域库里实查——既不信前端传参，
     * 也不单信生产端回写的 {@code tradeStatus}：回写失败时生产端仍显示"未上架"，
     * 而商品其实已经建出来了，那种情况下必须让承接方看到"已被我承接"并能重试，
     * 而不是再建一件重复商品。</p>
     */
    public Map<String, Object> claimablePool(int pageNum, int pageSize, String keyword, String auditStatus) {
        PlatformIdentityService.MerchantScope scope = requireScope();
        Map<String, Object> page = rawPool(pageNum, pageSize, keyword, auditStatus);
        List<Map<String, Object>> records = mapRows(page.get("records"));
        List<String> offerNos = records.stream().map(row -> str(row.get("offerNo")))
                .filter(Objects::nonNull).toList();
        Map<String, TradeProduct> claimedByOffer = new LinkedHashMap<>();
        if (!offerNos.isEmpty()) {
            for (TradeProduct product : productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                    .eq(TradeProduct::getDelFlag, 0)
                    .in(TradeProduct::getSourceOfferNo, offerNos))) {
                claimedByOffer.putIfAbsent(product.getSourceOfferNo(), product);
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> row : records) {
            Map<String, Object> view = new LinkedHashMap<>(row);
            TradeProduct product = claimedByOffer.get(str(row.get("offerNo")));
            view.put("claimed", product != null);
            view.put("claimedByMe", product != null && scope.merchantIds().contains(product.getSellerId()));
            view.put("claimedProductCode", product == null ? null : product.getProductCode());
            rows.add(view);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", rows);
        data.put("total", page.get("total"));
        data.put("pageNum", page.get("pageNum"));
        data.put("pageSize", page.get("pageSize"));
        data.put("merchants", scope.bindings());
        return data;
    }

    /**
     * 供应商承接一张供给意向：接受（回写生产端，操作人记成承接方）→ 以**承接方自己的主体号**建品 → 回写上架。
     *
     * <p>这一步过去在平台运营端点，而且建出来的商品 {@code seller_id} 被写成**生产主体**的编号——
     * 等于平台替供应商建了一件挂在农场名下的商品：供应商既改不了价，也对不上自己的账。
     * 现在承接方就是卖家主体本人，货源主体只作为来源信息留在批次号与描述里。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public TradeProduct claim(String offerNo, Long requestedSellerId, BigDecimal listedQty, BigDecimal price) {
        PlatformIdentityService.MerchantSelection seller = identityService.selectMerchant(requestedSellerId);
        if (!seller.ok()) {
            throw new IllegalArgumentException(seller.error());
        }
        Map<String, Object> offer = offer(offerNo);
        if (str(offer.get("offerNo")) == null) {
            throw new IllegalArgumentException("生产端查不到这张供给意向（可能已关闭或单号填错）");
        }
        List<TradeProduct> existing = productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                .eq(TradeProduct::getDelFlag, 0)
                .eq(TradeProduct::getSourceOfferNo, offerNo)
                .last("LIMIT 1"));
        if (!existing.isEmpty()) {
            TradeProduct dup = existing.get(0);
            throw new IllegalArgumentException("该供给单已被承接（商品 " + dup.getProductCode()
                    + "），不能重复建品；要改价去「我的承接商品」里改");
        }
        return buildFromOffer(offer, seller, listedQty, price);
    }

    /**
     * 把"接受这张意向"回写生产端。auditor 写承接方主体名，不是点按钮的账号——留痕要留"谁接的货"。
     *
     * <p>刻意放在本地建品之后、且容忍"当前不是待承接状态"：上一轮如果商品建成但上架回写失败，
     * 本地事务回滚后生产端仍是已接受状态，重试承接要能走通，不能卡在"重复接受"这句报错上。</p>
     */
    private void markAccepted(String offerNo, PlatformIdentityService.MerchantSelection seller) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("approved", true);
        payload.put("auditor", "供应商承接：" + seller.merchantName());
        payload.put("remark", "由供应商主体 " + seller.merchantId() + "（" + seller.merchantName() + "）在卖家中心承接");
        Map<String, Object> res = production.p2tAudit(auth(), channel(), offerNo, payload);
        boolean ok = res != null && res.get("code") instanceof Number number && number.intValue() == 0;
        if (!ok && !String.valueOf(messageOf(res)).contains("不是待审核状态")) {
            throw new IllegalArgumentException("生产端接受供给单失败：" + messageOf(res));
        }
    }

    /**
     * 我的承接商品：只列本主体建出来的直供商品。
     *
     * <p>数据范围一律由令牌推出的主体号集合来筛，不接受前端传 sellerId——
     * 传别人的主体号就能看到别人的成本与定价。</p>
     */
    public Map<String, Object> myProductPage(List<Long> merchantIds, int pageNum, int pageSize, String keyword) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (merchantIds == null || merchantIds.isEmpty()) {
            data.put("records", List.of());
            data.put("total", 0);
            data.put("pageNum", safePage(pageNum));
            data.put("pageSize", safeSize(pageSize));
            data.put("reason", "当前账号还没有绑定经营主体，承接不到供给单");
            return data;
        }
        Page<TradeProduct> page = productMapper.selectPage(new Page<>(safePage(pageNum), safeSize(pageSize)),
                new LambdaQueryWrapper<TradeProduct>()
                        .eq(TradeProduct::getDelFlag, 0)
                        .in(TradeProduct::getSellerId, merchantIds)
                        .isNotNull(TradeProduct::getSourceOfferNo)
                        .like(keyword != null && !keyword.isBlank(), TradeProduct::getProductName,
                                keyword == null ? "" : keyword.trim())
                        .orderByDesc(TradeProduct::getCreateTime));
        data.put("records", page.getRecords());
        data.put("total", page.getTotal());
        data.put("pageNum", page.getCurrent());
        data.put("pageSize", page.getSize());
        return data;
    }

    /** 承接方改自己商品的挂牌价：先证明这件商品是我的，再改。 */
    @Transactional(rollbackFor = Exception.class)
    public TradeProduct updateMyPrice(List<Long> merchantIds, Long id, BigDecimal price) {
        if (price == null || price.signum() <= 0) {
            throw new IllegalArgumentException("挂牌价必须大于 0");
        }
        TradeProduct product = id == null ? null : productMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag()) || product.getSourceOfferNo() == null) {
            throw new IllegalArgumentException("商品不存在，或不是产销对接承接出来的商品");
        }
        if (merchantIds == null || !merchantIds.contains(product.getSellerId())) {
            throw new IllegalArgumentException("这不是你所属经营主体承接的商品，无权改价");
        }
        product.setPrice(price);
        product.setUnitPrice(price);
        product.setPriceMax(price);
        product.setPriceMin(price.multiply(new BigDecimal("0.92")).setScale(2, RoundingMode.HALF_UP));
        product.setUpdateTime(new Date());
        productMapper.updateById(product);
        return product;
    }

    /** 身份解析失败绝不退化成"看全部"或"空列表"：直接拒绝，让调用方知道是身份服务不可达。 */
    private PlatformIdentityService.MerchantScope requireScope() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            throw new IllegalStateException("无法确认你所属的经营主体（身份服务不可达）：" + scope.error());
        }
        return scope;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> mapRows(Object value) {
        if (value instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }

    /* ==================== 承接建品 ==================== */

    /**
     * 由承接方（卖家主体）把一张供给意向变成自己的在售商品，并把上架结果回写生产端。
     *
     * <p>这里不再要求供给单"已被平台审核通过"——承接这个动作本身就是接受。
     * 重复承接由 {@link #claim} 按 {@code source_offer_no} 在交易域库里挡掉；
     * 生产端的 {@code tradeStatus=LISTED} 只当第二道提示用，因为回写失败时它可能还是旧值，
     * 拿它当唯一判据会让"已经建好的商品"看不见、再建一件重复的。</p>
     */
    private TradeProduct buildFromOffer(Map<String, Object> offer,
                                        PlatformIdentityService.MerchantSelection seller,
                                        BigDecimal listedQty, BigDecimal price) {
        String offerNo = str(offer.get("offerNo"));
        if ("LISTED".equals(String.valueOf(offer.get("tradeStatus")))) {
            throw new IllegalArgumentException("该供给单在生产端已标记为已上架，请先在「我的承接商品」里核对");
        }
        BigDecimal available = decimal(offer.get("availableQty"));
        BigDecimal reserved = decimal(offer.get("reservedQty"));
        BigDecimal maxListable = available.subtract(reserved).max(BigDecimal.ZERO);

        if (listedQty == null || listedQty.signum() <= 0) {
            listedQty = maxListable;
        }
        if (maxListable.signum() <= 0) {
            throw new IllegalArgumentException("这张供给单已无可上架量（可供 " + available
                    + "，已认购 " + reserved + "）");
        }
        if (listedQty.compareTo(maxListable) > 0) {
            throw new IllegalArgumentException("上架可售量超过供给可售上限：" + maxListable.stripTrailingZeros().toPlainString());
        }
        if (price == null || price.signum() <= 0) {
            throw new IllegalArgumentException("请填写挂牌价（大于 0）");
        }

        String categoryCode = str(offer.get("categoryCode"));
        TradeProductCategory category = categoryCode == null ? null
                : categoryMapper.selectOne(new LambdaQueryWrapper<TradeProductCategory>()
                .eq(TradeProductCategory::getCategoryCode, categoryCode)
                .eq(TradeProductCategory::getDelFlag, 0).last("LIMIT 1"));

        Date now = new Date();
        BigDecimal supplyQty = decimal(offer.get("sourceOfferQty"));
        if (supplyQty == null) supplyQty = available;

        TradeProduct product = new TradeProduct();
        product.setProductCode(nextProductCode());
        product.setProductName(buildTitle(offer));
        product.setCategoryId(category == null ? null : category.getId());
        product.setCategoryCode(categoryCode);
        product.setCategoryName(category == null
                ? str(offer.get("categoryName")) : category.getCategoryName());
        product.setSellerId(seller.merchantId());
        product.setSellerName(seller.merchantName());
        product.setVariety(str(offer.get("cropName")));
        product.setOriginProvince("河南");
        product.setOriginCity(null);
        product.setOriginDistrict(null);
        product.setOriginAddress(str(offer.get("origin")));
        product.setSpecLevel("一级");
        product.setQualityLevel("一级");
        product.setSpecSize("统货");
        product.setUnit(str(offer.get("unit")) == null ? "kg" : str(offer.get("unit")));
        product.setStockQuantity(listedQty);
        product.setPrice(price);
        product.setUnitPrice(price);
        // 品类限价下浮 8% 兜底（规则配置里可调），只做提示不阻断定价自由
        product.setPriceMin(price.multiply(new BigDecimal("0.92")).setScale(2, RoundingMode.HALF_UP));
        product.setPriceMax(price);
        product.setPriceType("fixed");
        product.setMinOrderQuantity(decimal(offer.get("minOrderQty")));
        product.setHarvestBatchNo(str(offer.get("batchNo")));
        product.setSourceOfferNo(offerNo);
        product.setSourceOfferQty(supplyQty);
        product.setCertificationJson("[]");
        product.setQualityReportUrl(null);
        // seller_name 现在是承接方，货源主体必须留在这里：详情页与对账都要靠它回溯到农场
        product.setDescription("生产直供 · 货源主体 " + str(offer.get("tenantId"))
                + "（" + (str(offer.get("farmName")) == null ? "农场名未填" : str(offer.get("farmName"))) + "）"
                + " · 来源供给 " + offerNo
                + (str(offer.get("qualityNo")) == null ? "" : " · 质检 " + str(offer.get("qualityNo"))));
        product.setViewCount(0);
        product.setFavoriteCount(0);
        product.setInquiryCount(0);
        product.setSalesVolume(0);
        product.setPublishStatus("published");
        product.setAuditRemark("由供应商主体 " + seller.merchantId() + "（" + seller.merchantName()
                + "）在卖家中心承接供给单 " + offerNo + " 建品，不是平台代建");
        product.setAuditTime(now);
        product.setAuditor(SecurityUtils.getUsername());
        product.setStatus(1);
        product.setDelFlag(0);
        product.setCreateBy(SecurityUtils.getUsername());
        product.setCreateTime(now);
        product.setUpdateTime(now);
        productMapper.insert(product);

        // 先让生产端知道"这张单被供应商接受了"，再把上架结果回写。
        // 两次回写的响应都必须验：以前直接丢掉返回值，出现过"商品建好了、农场侧还显示未上架"，
        // 而且没人报错——对账时才发现两边说法不一致。回写失败就整体回滚，别留半成功。
        markAccepted(offerNo, seller);
        Map<String, Object> listed = new LinkedHashMap<>();
        listed.put("productCode", product.getProductCode());
        listed.put("productName", product.getProductName());
        listed.put("listedQty", listedQty);
        listed.put("listedPrice", price);
        dataOf(production.p2tListed(auth(), channel(), offerNo, listed));
        return product;
    }

    private String buildTitle(Map<String, Object> offer) {
        String crop = str(offer.get("cropName"));
        String variety = str(offer.get("varietyName"));
        String window = "";
        if (offer.get("windowStart") != null && offer.get("windowEnd") != null) {
            window = " · " + offer.get("windowStart") + " 起发货";
        }
        return (crop == null ? "农产品" : crop)
                + (variety == null || variety.isBlank() ? "" : "·" + variety)
                + " 一级 产地直供"
                + window;
    }

    private String nextProductCode() {
        String prefix = "SPU" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = productMapper.selectCount(new LambdaQueryWrapper<TradeProduct>()
                .likeRight(TradeProduct::getProductCode, prefix));
        return prefix + String.format("%04d", count + 1);
    }

    /* ==================== 订单回写 ==================== */

    /**
     * 订单支付成功后回写生产端认购量。
     *
     * <p>回写失败**不能影响支付结果**：订单照常履约，生产端靠重试队列补齐；
     * 失败期间仍计为已认购（宁可少卖不超卖）。</p>
     */
    public void writebackOrder(TradeOrder order) {
        if (order == null || order.getSourceOfferNo() == null || order.getSourceOfferNo().isBlank()) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("offerNo", order.getSourceOfferNo());
        payload.put("orderNo", order.getOrderNo());
        payload.put("qty", order.getTotalQuantity());
        payload.put("buyerName", order.getBuyerName());
        payload.put("buyerType", order.getBuyerType());
        OrderItem item = orderItemMapper.selectOne(new LambdaQueryWrapper<OrderItem>()
                .eq(OrderItem::getOrderId, order.getId()).last("LIMIT 1"));
        payload.put("grade", item == null ? "统货" : item.getSpecLevel());
        payload.put("lockFrom", LocalDate.now().toString());
        payload.put("lockTo", LocalDate.now().plusDays(10).toString());
        payload.put("eventType", "ORDER_PAID");
        try {
            Map<String, Object> res = production.p2tWriteback(auth(), channel(), payload);
            Object code = res == null ? null : res.get("code");
            boolean ok = code instanceof Number && ((Number) code).intValue() == 0;
            order.setP2tWritebackStatus(ok ? "SUCCESS" : "FAILED");
            order.setP2tWritebackMessage(ok ? "已回写生产端认购量" : messageOf(res));
        } catch (Exception e) {
            log.warn("产销回写失败：order={} offer={} {}", order.getOrderNo(), order.getSourceOfferNo(), e.getMessage());
            order.setP2tWritebackStatus("FAILED");
            order.setP2tWritebackMessage("生产端接口不可达：" + e.getMessage());
        }
        order.setP2tWritebackTime(new Date());
        orderMapper.updateById(order);
    }

    public Map<String, Object> retryWriteback(String orderNo) {
        TradeOrder order = orderMapper.selectOne(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getOrderNo, orderNo).eq(TradeOrder::getDelFlag, 0).last("LIMIT 1"));
        if (order == null) {
            throw new IllegalArgumentException("订单不存在：" + orderNo);
        }
        if (order.getSourceOfferNo() == null || order.getSourceOfferNo().isBlank()) {
            throw new IllegalArgumentException("该订单不是生产直供订单，无需回写");
        }
        order.setP2tWritebackStatus("RETRYING");
        orderMapper.updateById(order);
        writebackOrder(order);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderNo", order.getOrderNo());
        data.put("status", order.getP2tWritebackStatus());
        data.put("message", order.getP2tWritebackMessage());
        return data;
    }

    public Map<String, Object> orderPage(int pageNum, int pageSize, String keyword, String status) {
        Page<TradeOrder> page = new Page<>(safePage(pageNum), safeSize(pageSize));
        LambdaQueryWrapper<TradeOrder> w = new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getDelFlag, 0)
                .isNotNull(TradeOrder::getSourceOfferNo);
        if (status != null && !status.isBlank()) {
            w.eq(TradeOrder::getP2tWritebackStatus, status.trim().toUpperCase());
        }
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(TradeOrder::getOrderNo, kw)
                    .or().like(TradeOrder::getBuyerName, kw)
                    .or().like(TradeOrder::getSourceOfferNo, kw));
        }
        w.orderByDesc(TradeOrder::getCreateTime);
        Page<TradeOrder> result = orderMapper.selectPage(page, w);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", result.getRecords());
        data.put("total", result.getTotal());
        data.put("pageNum", result.getCurrent());
        data.put("pageSize", result.getSize());
        return data;
    }

    /* ==================== 对账 / 差异 / 链路 ==================== */

    public Object reconciliation() {
        Map<String, Object> res = production.p2tReconciliation(auth(), channel());
        Object code = res == null ? null : res.get("code");
        boolean ok = code instanceof Number && ((Number) code).intValue() == 0;
        if (!ok) {
            throw new IllegalArgumentException(messageOf(res));
        }
        return res.get("data");
    }

    public Map<String, Object> diffs(int pageNum, int pageSize, String status) {
        return dataOf(production.p2tDiffs(auth(), channel(), safePage(pageNum), safeSize(pageSize), blankToNull(status)));
    }

    public Map<String, Object> handleDiff(Long id, Map<String, Object> payload) {
        return dataOf(production.p2tHandleDiff(auth(), channel(), id, payload));
    }

    public Map<String, Object> trace(String batchNo) {
        return dataOf(production.p2tTrace(auth(), channel(), batchNo));
    }

    /* ==================== 规则配置 ==================== */

    public List<P2tRuleConfig> rules() {
        return ruleMapper.selectList(new LambdaQueryWrapper<P2tRuleConfig>()
                .eq(P2tRuleConfig::getStatus, 1).orderByAsc(P2tRuleConfig::getId));
    }

    @Transactional(rollbackFor = Exception.class)
    public P2tRuleConfig saveRule(String ruleCode, String ruleJson, String version) {
        P2tRuleConfig rule = ruleMapper.selectOne(new LambdaQueryWrapper<P2tRuleConfig>()
                .eq(P2tRuleConfig::getRuleCode, ruleCode).last("LIMIT 1"));
        if (rule == null) {
            rule = new P2tRuleConfig();
            rule.setRuleCode(ruleCode);
            rule.setRuleName(ruleCode);
            rule.setRuleJson(ruleJson);
            rule.setVersion(version == null || version.isBlank() ? "RULE-P2T-V4" : version);
            rule.setStatus(1);
            rule.setCreateTime(new Date());
            rule.setUpdateTime(new Date());
            ruleMapper.insert(rule);
        } else {
            rule.setRuleJson(ruleJson);
            rule.setUpdateTime(new Date());
            ruleMapper.updateById(rule);
        }
        return rule;
    }

    /* ==================== 工具 ==================== */

    private String channel() {
        if (channelToken == null || channelToken.isBlank()) {
            throw new IllegalArgumentException("未配置产销对接服务通道密钥（p2t.trade-channel-token）");
        }
        return channelToken;
    }

    /** 生产端写接口仍要求登录态：原样转发调用方的 Authorization（不用于租户，只用于准入）。 */
    private String auth() {
        HttpServletRequest request = SecurityUtils.getRequest();
        String header = request == null ? null : request.getHeader("Authorization");
        if (header == null || header.isBlank()) {
            throw new IllegalArgumentException("未登录：缺少 Authorization");
        }
        return header;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> dataOf(Map<String, Object> res) {
        if (res == null) {
            throw new IllegalArgumentException("生产端无响应");
        }
        Object code = res.get("code");
        boolean ok = code instanceof Number && ((Number) code).intValue() == 0;
        if (!ok) {
            throw new IllegalArgumentException(messageOf(res));
        }
        Object data = res.get("data");
        if (data instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("data", data);
        return wrapper;
    }

    private String messageOf(Map<String, Object> res) {
        if (res == null) return "生产端无响应";
        Object message = res.get("message");
        return message == null ? "生产端返回失败" : String.valueOf(message);
    }

    private static int safePage(int v) { return v > 0 ? v : 1; }
    private static int safeSize(int v) { return v > 0 ? v : 10; }
    private static String blankToNull(String v) { return v == null || v.isBlank() ? null : v.trim(); }
    private static String str(Object v) { return v == null ? null : String.valueOf(v); }

    private static BigDecimal decimal(Object v) {
        if (v == null) return null;
        try {
            String text = String.valueOf(v).trim();
            return text.isEmpty() ? null : new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("数字格式不正确：" + v);
        }
    }

    private static Long longOf(Object v) {
        if (v == null) return null;
        try {
            return Long.valueOf(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
