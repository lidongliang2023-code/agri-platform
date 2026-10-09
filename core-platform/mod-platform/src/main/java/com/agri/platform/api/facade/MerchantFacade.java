package com.agri.platform.api.facade;

import com.agri.platform.api.dto.MerchantDTO;

/**
 * 客商中心 OHS 门面。
 */
public interface MerchantFacade {

    MerchantDTO getMerchant(Long merchantId);
}
