package com.agri.production.mapper;

import com.agri.production.entity.P2tOffer;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

/** 供给意向 Mapper */
public interface P2tOfferMapper extends BaseMapper<P2tOffer> {
    /** 调用前必须先锁定同主体采收批次，与供给创建保持一致的锁顺序。 */
    @org.apache.ibatis.annotations.Select("SELECT id FROM agri_p2t_offer WHERE tenant_id = #{tenantId} AND batch_id = #{batchId} AND deleted = 0 ORDER BY id FOR UPDATE")
    java.util.List<Long> lockBatchOfferIds(@org.apache.ibatis.annotations.Param("batchId") Long batchId,
                                         @org.apache.ibatis.annotations.Param("tenantId") String tenantId);

}
