package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 价格守卫：把低于供货价/供应商最低限价的分销商品自动下架（关闭渠道货架），并通知渠道。
 *
 * <p>只下架货架，不撤销授权、不改零售价；每次下架留一条巡检记录，便于运营追溯。
 * 渠道调价到区间内后可重新上架。</p>
 */
@Service
public class PriceGuardService {

    private final ChannelProductMapper channelProductMapper;
    private final ProductMapper productMapper;
    private final NoticeService noticeService;
    private final JdbcTemplate jdbc;

    public PriceGuardService(ChannelProductMapper channelProductMapper, ProductMapper productMapper,
                             NoticeService noticeService, JdbcTemplate jdbc) {
        this.channelProductMapper = channelProductMapper;
        this.productMapper = productMapper;
        this.noticeService = noticeService;
        this.jdbc = jdbc;
    }

    public int enforceProduct(Product product) {
        return enforceProduct(product, "MANUAL");
    }

    @Transactional
    public int enforceProduct(Product product, String source) {
        if (product == null || product.getId() == null) return 0;
        BigDecimal floor = product.getPrice();
        if (product.getMinRetailPrice() != null
                && (floor == null || product.getMinRetailPrice().compareTo(floor) > 0)) {
            floor = product.getMinRetailPrice();
        }
        if (floor == null) return 0;
        List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getProductId, product.getId())
                .eq(ChannelProduct::getStatus, "ACTIVE"));
        int offShelf = 0;
        for (ChannelProduct relation : relations) {
            if ("OFF".equalsIgnoreCase(relation.getShelfStatus())) continue;
            BigDecimal retail = relation.getRetailPrice() != null ? relation.getRetailPrice() : product.getPrice();
            if (retail == null || retail.compareTo(floor) >= 0) continue;
            relation.setShelfStatus("OFF");
            channelProductMapper.updateById(relation);
            noticeService.notify("CHANNEL", relation.getChannelId(), "PRODUCT_AUTO_OFF_SHELF",
                    "商品因低于供货价被自动下架",
                    "商品「" + product.getName() + "」当前零售价 ¥" + retail + " 低于底价 ¥" + floor
                            + "，已自动下架；调价到区间内后可重新上架", "PRODUCT", product.getId());
            jdbc.update("INSERT INTO s2b2c_price_guard_log (id, product_id, product_name, supplier_id, "
                            + "channel_id, relation_id, retail_price, floor_price, action, trigger_source, create_time) "
                            + "VALUES (?,?,?,?,?,?,?,?,?,?,NOW())",
                    IdWorker.getId(), product.getId(), product.getName(), product.getSupplierId(),
                    relation.getChannelId(), relation.getId(), retail, floor, "AUTO_OFF_SHELF", source);
            offShelf++;
        }
        return offShelf;
    }

    /** 扫描全部已审核商品（供应商手动扫描/平台巡检/每日定时任务共用）。 */
    @Transactional
    public Map<String, Object> scanAll(String source) {
        List<Product> products = productMapper.selectList(new LambdaQueryWrapper<Product>()
                .eq(Product::getStatus, "APPROVED"));
        int offShelf = 0;
        int affectedProducts = 0;
        Set<Long> suppliers = new HashSet<>();
        for (Product product : products) {
            int count = enforceProduct(product, source);
            if (count > 0) {
                offShelf += count;
                affectedProducts++;
                if (product.getSupplierId() != null) suppliers.add(product.getSupplierId());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", products.size());
        result.put("offShelf", offShelf);
        result.put("products", affectedProducts);
        result.put("suppliers", suppliers.size());
        return result;
    }
}
