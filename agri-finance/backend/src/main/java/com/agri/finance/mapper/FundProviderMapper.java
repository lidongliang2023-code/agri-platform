package com.agri.finance.mapper;

import com.agri.finance.entity.FundProvider;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FundProviderMapper extends BaseMapper<FundProvider> {

    /** 串行化同一资金机构的额度校验，避免并发认购穿透机构可用余额。 */
    @Select("SELECT id FROM fund_provider WHERE id = #{providerId} AND del_flag = 0 FOR UPDATE")
    String lockProvider(@Param("providerId") String providerId);
}
