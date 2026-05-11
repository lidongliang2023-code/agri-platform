package com.agri.trade.mapper;

import com.agri.trade.entity.MatchRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface MatchRecordMapper extends BaseMapper<MatchRecord> {
    
    @Insert("<script>" +
            "INSERT INTO agri_trade_match_record " +
            "(demand_id, demand_no, product_id, product_name, seller_id, seller_name, " +
            "match_score, match_type, match_status, create_time, update_time, del_flag) " +
            "VALUES " +
            "<foreach collection='list' item='item' separator=','> " +
            "(#{item.demandId}, #{item.demandNo}, #{item.productId}, #{item.productName}, " +
            "#{item.sellerId}, #{item.sellerName}, #{item.matchScore}, #{item.matchType}, " +
            "#{item.matchStatus}, #{item.createTime}, #{item.updateTime}, #{item.delFlag}) " +
            "</foreach> " +
            "</script>")
    int insertBatch(@Param("list") List<MatchRecord> list);
}