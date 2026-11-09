package com.agri.production.mapper;

import com.agri.production.dto.AlertRecordQueryDTO;
import com.agri.production.entity.AlertRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AlertRecordMapper extends BaseMapper<AlertRecord> {

    @org.apache.ibatis.annotations.Select("SELECT * FROM agri_prod_alert_record WHERE id = #{id} AND deleted = 0 FOR UPDATE")
    AlertRecord lockForHandling(@Param("id") Long id);

    IPage<AlertRecord> pageQuery(Page<AlertRecord> page, @Param("dto") AlertRecordQueryDTO dto, @Param("tenantId") String tenantId);

    List<AlertRecord> selectByStatus(@Param("status") String status, @Param("tenantId") String tenantId);

    long countByLevel(@Param("level") String level, @Param("tenantId") String tenantId);

    long countByStatus(@Param("status") String status, @Param("tenantId") String tenantId);
}