package com.agri.masterdata.service;

import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.vo.CustomerVO;

import java.util.List;

public interface ICustomerService {

    List<CustomerVO> list();

    CustomerVO getById(Long id);

    void save(CustomerSaveDTO dto);

    void update(Long id, CustomerSaveDTO dto);

    void delete(Long id);
}
