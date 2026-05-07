package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Customer;
import com.agri.masterdata.vo.CustomerVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface CustomerMapper extends BaseMapper<Customer> {

    List<CustomerVO> selectCustomerList(@Param("tenantId") String tenantId);

    CustomerVO selectCustomerById(@Param("id") Long id);

    Customer selectByCustomerCode(@Param("customerCode") String customerCode);
}
