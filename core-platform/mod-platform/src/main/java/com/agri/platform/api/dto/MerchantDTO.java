package com.agri.platform.api.dto;

/**
 * 客商 DTO（OHS 对外契约，客户供应商统一）。
 */
public record MerchantDTO(Long id, Long marketId, String code, String name, String type, String creditCode,
                          String contactName, String contactPhone, Integer status) {
}
