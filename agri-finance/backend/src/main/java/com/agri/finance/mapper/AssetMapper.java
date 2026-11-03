package com.agri.finance.mapper;

import com.agri.finance.entity.Asset;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

@Mapper
public interface AssetMapper extends BaseMapper<Asset> {

    /**
     * 原子占用资产可投额度，避免并发认购造成超募。
     * 返回 0 表示额度或状态已变化，调用方必须终止本次投资。
     */
    @Update("""
            UPDATE asset
            SET invested_amount = COALESCE(invested_amount, 0) + #{amount},
                available_amount = available_amount - #{amount},
                status = CASE WHEN available_amount - #{amount} = 0 THEN '已售罄' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = #{assetId}
              AND del_flag = 0
              AND status = '可投资'
              AND available_amount >= #{amount}
            """)
    int reserveAmount(@Param("assetId") String assetId, @Param("amount") BigDecimal amount);
}
