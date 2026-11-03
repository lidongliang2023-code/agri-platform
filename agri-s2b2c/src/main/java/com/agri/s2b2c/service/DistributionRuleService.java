package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 供应商投放规则：渠道白名单 + 自动撤权。
 *
 * <p>规则收紧（关闭投放、设置白名单、降低最大渠道数）后，不符合条件的 ACTIVE 授权自动置 REVOKED，
 * 并通知对应渠道；历史订单与佣金不受影响。</p>
 */
@Service
public class DistributionRuleService {

    private final JdbcTemplate jdbc;
    private final ChannelProductMapper channelProductMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final NoticeService noticeService;

    public DistributionRuleService(JdbcTemplate jdbc, ChannelProductMapper channelProductMapper,
                                   ChannelPartnerMapper channelPartnerMapper, NoticeService noticeService) {
        this.jdbc = jdbc;
        this.channelProductMapper = channelProductMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.noticeService = noticeService;
    }

    public Set<Long> whitelist(Long productId) {
        Set<Long> ids = new HashSet<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT channel_id FROM s2b2c_distribution_whitelist WHERE product_id = ?", productId)) {
            ids.add(((Number) row.get("channel_id")).longValue());
        }
        return ids;
    }

    public Map<String, Object> rule(Long productId) {
        Set<Long> ids = whitelist(productId);
        List<Map<String, Object>> channels = new ArrayList<>();
        for (Long channelId : ids) {
            ChannelPartner channel = channelPartnerMapper.selectById(channelId);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("channelId", channelId);
            item.put("shopName", channel == null ? null : channel.getShopName());
            channels.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productId", productId);
        result.put("whitelist", channels);
        result.put("regionNames", regions(productId));
        return result;
    }

    /** 限售区域（省级名称）；空列表表示全国不限。 */
    public List<String> regions(Long productId) {
        List<String> names = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT region_name FROM s2b2c_distribution_region WHERE product_id = ? "
                        + "ORDER BY create_time, id", productId)) {
            Object name = row.get("region_name");
            if (name != null && !String.valueOf(name).isBlank()) {
                names.add(String.valueOf(name));
            }
        }
        return names;
    }

    /** 批量读取商品的限售区域，供渠道商品池展示。 */
    public Map<Long, List<String>> regionsFor(java.util.Collection<Long> productIds) {
        Map<Long, List<String>> result = new LinkedHashMap<>();
        if (productIds == null || productIds.isEmpty()) return result;
        List<Long> ids = new ArrayList<>(new HashSet<>(productIds));
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT product_id, region_name FROM s2b2c_distribution_region WHERE product_id IN ("
                        + placeholders + ") ORDER BY create_time, id", ids.toArray())) {
            Long productId = ((Number) row.get("product_id")).longValue();
            Object name = row.get("region_name");
            if (name != null && !String.valueOf(name).isBlank()) {
                result.computeIfAbsent(productId, key -> new ArrayList<>()).add(String.valueOf(name));
            }
        }
        return result;
    }

    @Transactional
    public void replaceRegions(Long productId, List<String> regionNames) {
        jdbc.update("DELETE FROM s2b2c_distribution_region WHERE product_id = ?", productId);
        if (regionNames == null || regionNames.isEmpty()) return;
        Set<String> seen = new HashSet<>();
        for (String raw : regionNames) {
            if (raw == null) continue;
            String name = raw.trim();
            if (name.isEmpty() || name.length() > 50 || !seen.add(name)) continue;
            jdbc.update("INSERT INTO s2b2c_distribution_region (id, product_id, region_name, create_time) "
                            + "VALUES (?,?,?,NOW()) ON DUPLICATE KEY UPDATE region_name = VALUES(region_name)",
                    com.baomidou.mybatisplus.core.toolkit.IdWorker.getId(), productId, name);
        }
    }

    /**
     * 渠道订单校验收货省份是否在限售区域。
     *
     * <p>区域按省级名称比较，忽略「省/市/自治区/特别行政区」等后缀，
     * 地址里带下级市名时按前缀匹配；没有配置区域视为全国可售。</p>
     */
    public void assertRegionAllowed(Product product, String province) {
        List<String> allowed = regions(product.getId());
        if (allowed.isEmpty()) return;
        String destination = normalizeRegion(province);
        for (String region : allowed) {
            String normalized = normalizeRegion(region);
            if (normalized.isEmpty()) continue;
            if (normalized.equals(destination) || destination.startsWith(normalized)) return;
        }
        throw new IllegalArgumentException("商品「" + product.getName() + "」限售区域为 "
                + String.join("、", allowed) + "，当前收货地址不在可售范围");
    }

    private static String normalizeRegion(String region) {
        if (region == null) return "";
        String name = region.trim().replace("特别行政区", "").replace("自治区", "");
        name = name.replaceAll("(壮族|回族|维吾尔|藏族)$", "");
        while (name.endsWith("省") || name.endsWith("市")) {
            name = name.substring(0, name.length() - 1);
        }
        return name;
    }

    @Transactional
    public void replaceWhitelist(Long productId, List<Long> channelIds) {
        jdbc.update("DELETE FROM s2b2c_distribution_whitelist WHERE product_id = ?", productId);
        if (channelIds == null) return;
        for (Long channelId : channelIds) {
            if (channelId == null) continue;
            jdbc.update("INSERT INTO s2b2c_distribution_whitelist (id, product_id, channel_id, create_time) "
                            + "VALUES (?,?,?,NOW()) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)",
                    com.baomidou.mybatisplus.core.toolkit.IdWorker.getId(), productId, channelId);
        }
    }

    public void assertAllowed(Product product, Long channelId) {
        if (Boolean.FALSE.equals(product.getDistributionEnabled())) {
            throw new IllegalArgumentException("供应商已关闭该商品的渠道投放");
        }
        Set<Long> whitelist = whitelist(product.getId());
        if (!whitelist.isEmpty() && !whitelist.contains(channelId)) {
            throw new IllegalArgumentException("供应商未向该渠道开放投放（白名单限制）");
        }
    }

    /** 按最新规则撤销不符合条件的 ACTIVE 授权，返回撤销数量。 */
    @Transactional
    public int autoRevoke(Product product) {
        List<ChannelProduct> active = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getProductId, product.getId())
                .eq(ChannelProduct::getStatus, "ACTIVE")
                .orderByAsc(ChannelProduct::getPickedAt));
        if (active.isEmpty()) return 0;
        Set<Long> whitelist = whitelist(product.getId());
        List<ChannelProduct> survivors = new ArrayList<>();
        if (!Boolean.FALSE.equals(product.getDistributionEnabled())) {
            for (ChannelProduct relation : active) {
                if (whitelist.isEmpty() || whitelist.contains(relation.getChannelId())) {
                    survivors.add(relation);
                }
            }
        }
        Integer max = product.getMaxChannels();
        if (max != null && max > 0 && survivors.size() > max) {
            survivors = new ArrayList<>(survivors.subList(0, max));
        }
        Set<Long> keep = new HashSet<>();
        for (ChannelProduct relation : survivors) {
            keep.add(relation.getId());
        }
        int revoked = 0;
        for (ChannelProduct relation : active) {
            if (keep.contains(relation.getId())) continue;
            relation.setStatus("REVOKED");
            channelProductMapper.updateById(relation);
            noticeService.notify("CHANNEL", relation.getChannelId(), "DISTRIBUTION_REVOKED",
                    "渠道授权已被供应商撤销",
                    "商品「" + product.getName() + "」的渠道授权已按供应商投放规则撤销", "PRODUCT", product.getId());
            revoked++;
        }
        return revoked;
    }
}
