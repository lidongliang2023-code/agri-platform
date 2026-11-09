package com.agri.platform.internal.merchant;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MerchantMapper extends BaseMapper<MerchantEntity> {
    /** 所有认证写入口先锁主体，再读取申请，避免并发重提和审核覆盖。 */
    default MerchantEntity lockById(Long id) {
        return selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<MerchantEntity>()
                .eq(MerchantEntity::getId, id).last("FOR UPDATE"));
    }

}
