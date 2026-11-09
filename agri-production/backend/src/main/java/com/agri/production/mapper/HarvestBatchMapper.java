package com.agri.production.mapper;

import com.agri.production.entity.HarvestBatch;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface HarvestBatchMapper extends BaseMapper<HarvestBatch> {
    @org.apache.ibatis.annotations.Select("SELECT id AS batch_id, agri_prod_harvest_batch.* FROM agri_prod_harvest_batch WHERE id = #{id} AND tenant_id = #{tenantId} AND deleted = 0 FOR UPDATE")
    HarvestBatch lockOwned(@org.apache.ibatis.annotations.Param("id") Long id,
                           @org.apache.ibatis.annotations.Param("tenantId") String tenantId);

}
