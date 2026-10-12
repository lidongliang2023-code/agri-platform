package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.CustomerSupplierRelation;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface CustomerSupplierRelationMapper extends BaseMapper<CustomerSupplierRelation> {

    List<CustomerSupplierRelation> selectByCustomerId(String customerId);

    List<CustomerSupplierRelation> selectBySupplierId(String supplierId);

    List<CustomerSupplierRelation> selectByRelationType(String relationType);

    CustomerSupplierRelation selectByCustomerAndSupplier(String customerId, String supplierId);
}