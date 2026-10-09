package com.agri.platform.internal.merchant;

import com.agri.platform.api.dto.MerchantDTO;
import com.agri.platform.api.facade.MerchantFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 客商中心 OHS 门面实现。
 */
@Service
@RequiredArgsConstructor
public class MerchantFacadeImpl implements MerchantFacade {

    private final MerchantMapper merchantMapper;

    @Override
    public MerchantDTO getMerchant(Long merchantId) {
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        return merchant == null ? null : new MerchantDTO(merchant.getId(), merchant.getMarketId(),
                merchant.getCode(), merchant.getName(), merchant.getType(), merchant.getCreditCode(),
                merchant.getContactName(), merchant.getContactPhone(), merchant.getStatus());
    }
}
