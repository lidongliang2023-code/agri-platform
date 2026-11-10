package com.agri.finance.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface WarehouseMonitorAccessMapper {
    // 资产 ID 按审批服务的确定性规则生成，必须同时匹配申请、借款人及有效认购。
    @Select("""
        SELECT COUNT(*) FROM investment i
        JOIN asset a ON a.id = i.asset_id AND a.del_flag = 0
        WHERE i.provider_id = #{providerId} AND i.asset_id = #{assetId}
          AND a.borrower_id = #{borrowerId}
          AND i.del_flag = 0 AND i.status IN ('投资中', '待回款')
          AND i.investment_amount > 0
        """)
    long activeFunding(@Param("providerId") String providerId, @Param("assetId") String assetId,
                       @Param("borrowerId") String borrowerId);
}
