package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Supplier;
import com.agri.masterdata.vo.SupplierVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupplierMapper extends BaseMapper<Supplier> {

    List<SupplierVO> selectSupplierList(@Param("tenantId") String tenantId);

    SupplierVO selectSupplierById(@Param("id") Long id);

    Supplier selectBySupplierCode(@Param("supplierCode") String supplierCode);
}
