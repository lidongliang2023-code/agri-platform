package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.ChannelPartnerService;
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

@Service
public class ChannelPartnerServiceImpl extends ServiceImpl<ChannelPartnerMapper, ChannelPartner> implements ChannelPartnerService {

    private final ProductMapper productMapper;
    private final CommissionMapper commissionMapper;
    private final OrderMapper orderMapper;
    private final ObjectMapper objectMapper;

    public ChannelPartnerServiceImpl(ProductMapper productMapper, CommissionMapper commissionMapper, OrderMapper orderMapper, ObjectMapper objectMapper) {
        this.productMapper = productMapper;
        this.commissionMapper = commissionMapper;
        this.orderMapper = orderMapper;
        this.objectMapper = objectMapper;
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
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getChannelId, channelId);
        wrapper.eq(Product::getStatus, "APPROVED");
        wrapper.orderByDesc(Product::getUpdateTime);

        Page<Product> pageQuery = new Page<>(page, size);
        IPage<Product> pageResult = productMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertProductToVO);
    }

    @Override
    public boolean selectProduct(Long channelId, Long productId) {
        Product product = productMapper.selectById(productId);
        if (product == null) return false;
        product.setChannelId(channelId);
        product.setUpdateTime(LocalDateTime.now());
        return productMapper.updateById(product) > 0;
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