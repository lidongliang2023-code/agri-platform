package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.ChannelPartnerService;
import com.agri.s2b2c.service.DistributionRuleService;
import com.agri.s2b2c.vo.ChannelPartnerVO;
import com.agri.s2b2c.vo.CommissionVO;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChannelPartnerServiceImpl extends ServiceImpl<ChannelPartnerMapper, ChannelPartner> implements ChannelPartnerService {

    private final ProductMapper productMapper;
    private final ChannelProductMapper channelProductMapper;
    private final CommissionMapper commissionMapper;
    private final OrderMapper orderMapper;
    private final ObjectMapper objectMapper;
    private final DistributionRuleService distributionRuleService;

    public ChannelPartnerServiceImpl(ProductMapper productMapper, ChannelProductMapper channelProductMapper,
                                     CommissionMapper commissionMapper, OrderMapper orderMapper, ObjectMapper objectMapper,
                                     DistributionRuleService distributionRuleService) {
        this.productMapper = productMapper;
        this.channelProductMapper = channelProductMapper;
        this.commissionMapper = commissionMapper;
        this.orderMapper = orderMapper;
        this.objectMapper = objectMapper;
        this.distributionRuleService = distributionRuleService;
    }

    @Override
    public ChannelPartnerVO getById(Long id) {
        ChannelPartner partner = baseMapper.selectById(id);
        return convertToVO(partner);
    }

    @Override
    public IPage<ChannelPartnerVO> pageList(int page, int size, String keyword, String auditStatus) {
        LambdaQueryWrapper<ChannelPartner> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(ChannelPartner::getCompanyName, keyword)
                   .or()
                   .like(ChannelPartner::getContactName, keyword)
                   .or()
                   .like(ChannelPartner::getContactPhone, keyword);
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(ChannelPartner::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(ChannelPartner::getCreateTime);

        Page<ChannelPartner> pageQuery = new Page<>(page, size);
        IPage<ChannelPartner> pageResult = baseMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertToVO);
    }

    @Override
    public boolean apply(ChannelPartner partner) {
        partner.setAuditStatus("PENDING");
        partner.setStatus("ACTIVE");
        partner.setGrade("LEVEL_1");
        partner.setCreateTime(LocalDateTime.now());
        partner.setUpdateTime(LocalDateTime.now());
        return save(partner);
    }

    @Override
    public boolean reapply(ChannelPartner partner) {
        ChannelPartner existing = partner.getId() == null ? null : baseMapper.selectById(partner.getId());
        if (existing == null || !"REJECTED".equalsIgnoreCase(existing.getAuditStatus())) {
            return false;
        }
        partner.setUserId(existing.getUserId());
        partner.setAuditStatus("PENDING");
        partner.setStatus("ACTIVE");
        partner.setGrade(existing.getGrade() == null ? "LEVEL_1" : existing.getGrade());
        partner.setCreateTime(existing.getCreateTime());
        partner.setUpdateTime(LocalDateTime.now());
        return baseMapper.update(partner, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<ChannelPartner>()
                .eq(ChannelPartner::getId, existing.getId())
                .set(ChannelPartner::getAuditOpinion, null)
                .set(ChannelPartner::getAuditTime, null)) > 0;
    }

    @Override
    public boolean updateAudit(Long id, String auditStatus, String auditOpinion) {
        ChannelPartner partner = baseMapper.selectById(id);
        if (partner == null) return false;
        partner.setAuditStatus(auditStatus);
        partner.setAuditOpinion(auditOpinion);
        partner.setAuditTime(LocalDateTime.now());
        partner.setUpdateTime(LocalDateTime.now());
        return updateById(partner);
    }

    @Override
    public boolean updateInfo(ChannelPartner partner) {
        ChannelPartner existing = baseMapper.selectById(partner.getId());
        if (existing == null) return false;
        partner.setAuditStatus(existing.getAuditStatus());
        partner.setGrade(existing.getGrade());
        partner.setUpdateTime(LocalDateTime.now());
        return updateById(partner);
    }

    @Override
    public IPage<ProductVO> getSelectedProducts(Long channelId, int page, int size) {
        // 选品关系在 channel_product 里；商品仍归供应商，不再通过 product.channel_id 反查
        List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getChannelId, channelId)
                .eq(ChannelProduct::getStatus, "ACTIVE"));
        List<Long> productIds = relations.stream().map(ChannelProduct::getProductId)
                .filter(java.util.Objects::nonNull).distinct().toList();
        Page<Product> pageQuery = new Page<>(page, size);
        if (productIds.isEmpty()) {
            return pageQuery.convert(this::convertProductToVO);
        }
        Map<Long, ChannelProduct> relationByProduct = relations.stream()
                .collect(Collectors.toMap(ChannelProduct::getProductId, r -> r, (a, b) -> a));
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Product::getId, productIds);
        wrapper.eq(Product::getStatus, "APPROVED");
        wrapper.orderByDesc(Product::getUpdateTime);
        return productMapper.selectPage(pageQuery, wrapper).convert(product -> {
            ProductVO vo = convertProductToVO(product);
            ChannelProduct relation = relationByProduct.get(product.getId());
            if (vo != null && relation != null) {
                vo.setRetailPrice(relation.getRetailPrice());
                vo.setShelfStatus(relation.getShelfStatus() == null ? "ON" : relation.getShelfStatus());
                vo.setEffectivePrice(relation.getRetailPrice() != null && relation.getRetailPrice().signum() > 0
                        ? relation.getRetailPrice() : vo.getPrice());
            }
            return vo;
        });
    }

    @Override
    public boolean selectProduct(Long channelId, Long productId) {
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw new IllegalArgumentException("商品不存在");
        }
        if (!"APPROVED".equals(product.getStatus())) {
            throw new IllegalArgumentException("商品未通过审核，不能选品上架");
        }
        distributionRuleService.assertAllowed(product, channelId);
        // 只建立/恢复关系，绝不改写商品本身的归属（商品属于供应商，可被多个渠道同时选中）
        ChannelProduct existing = channelProductMapper.selectOne(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getChannelId, channelId)
                .eq(ChannelProduct::getProductId, productId)
                .last("LIMIT 1"));
        Integer maxChannels = product.getMaxChannels();
        if (maxChannels != null && maxChannels > 0
                && (existing == null || !"ACTIVE".equals(existing.getStatus()))) {
            Long activeCount = channelProductMapper.selectCount(new LambdaQueryWrapper<ChannelProduct>()
                    .eq(ChannelProduct::getProductId, productId)
                    .eq(ChannelProduct::getStatus, "ACTIVE"));
            if (activeCount != null && activeCount >= maxChannels) {
                throw new IllegalArgumentException("该商品授权渠道已达上限（" + maxChannels + " 个）");
            }
        }
        if (existing != null) {
            if ("ACTIVE".equals(existing.getStatus())) {
                return true;
            }
            existing.setStatus("ACTIVE");
            existing.setPickedAt(LocalDateTime.now());
            return channelProductMapper.updateById(existing) > 0;
        }
        ChannelProduct relation = new ChannelProduct();
        relation.setChannelId(channelId);
        relation.setProductId(productId);
        relation.setSupplierId(product.getSupplierId());
        relation.setStatus("ACTIVE");
        relation.setPickedAt(LocalDateTime.now());
        return channelProductMapper.insert(relation) > 0;
    }

    @Override
    public IPage<CommissionVO> getCommissions(Long channelId, int page, int size, String status) {
        LambdaQueryWrapper<Commission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Commission::getChannelId, channelId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Commission::getStatus, status);
        }
        wrapper.orderByDesc(Commission::getCreateTime);

        Page<Commission> pageQuery = new Page<>(page, size);
        IPage<Commission> pageResult = commissionMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertCommissionToVO);
    }

    @Override
    public BigDecimal getTotalCommission(Long channelId) {
        LambdaQueryWrapper<Commission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Commission::getChannelId, channelId);
        List<Commission> commissions = commissionMapper.selectList(wrapper);
        return commissions.stream().map(Commission::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ChannelPartnerVO convertToVO(ChannelPartner partner) {
        if (partner == null) return null;
        ChannelPartnerVO vo = new ChannelPartnerVO();
        BeanUtils.copyProperties(partner, vo);
        return vo;
    }

    private ProductVO convertProductToVO(Product product) {
        if (product == null) return null;
        ProductVO vo = new ProductVO();
        BeanUtils.copyProperties(product, vo);
        try {
            vo.setImages(objectMapper.readValue(product.getImages(), new TypeReference<List<String>>() {}));
        } catch (Exception e) {
            vo.setImages(List.of());
        }
        return vo;
    }

    private CommissionVO convertCommissionToVO(Commission commission) {
        if (commission == null) return null;
        CommissionVO vo = new CommissionVO();
        BeanUtils.copyProperties(commission, vo);
        Order order = orderMapper.selectById(commission.getOrderId());
        if (order != null) vo.setOrderNo(order.getOrderNo());
        return vo;
    }
}