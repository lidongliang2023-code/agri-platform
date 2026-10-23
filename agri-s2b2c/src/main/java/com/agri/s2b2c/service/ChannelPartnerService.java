package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.vo.ChannelPartnerVO;
import com.agri.s2b2c.vo.CommissionVO;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;

public interface ChannelPartnerService extends IService<ChannelPartner> {
    ChannelPartnerVO getById(Long id);
    IPage<ChannelPartnerVO> pageList(int page, int size, String keyword, String auditStatus);
    boolean apply(ChannelPartner partner);
    boolean updateAudit(Long id, String auditStatus, String auditOpinion);
    boolean updateInfo(ChannelPartner partner);
    IPage<ProductVO> getSelectedProducts(Long channelId, int page, int size);
    boolean selectProduct(Long channelId, Long productId);
    IPage<CommissionVO> getCommissions(Long channelId, int page, int size, String status);
    BigDecimal getTotalCommission(Long channelId);
}