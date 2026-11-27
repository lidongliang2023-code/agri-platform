package com.agri.s2b2c.mapper;

import com.agri.s2b2c.entity.CommissionWithdrawal;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CommissionWithdrawalMapper extends BaseMapper<CommissionWithdrawal> {
    /** 同一渠道的提现申请串行核算余额，锁随事务释放。 */
    @org.apache.ibatis.annotations.Select("SELECT id FROM s2b2c_channel_partner WHERE id = #{channelId} FOR UPDATE")
    Long lockChannel(@org.apache.ibatis.annotations.Param("channelId") Long channelId);
}
