package com.agri.masterdata.service;

import com.agri.masterdata.vo.OrganizationVO;

import java.util.List;

public interface IOrganizationService {

    List<OrganizationVO> getTree();

    void save(OrganizationVO vo);

    void update(Long id, OrganizationVO vo);

    void delete(Long id);
}
