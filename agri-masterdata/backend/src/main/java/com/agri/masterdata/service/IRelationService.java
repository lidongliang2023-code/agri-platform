package com.agri.masterdata.service;

import com.agri.masterdata.entity.CustomerSupplierRelation;

import java.util.List;

public interface IRelationService {

    List<CustomerSupplierRelation> listByCustomerId(String customerId);

    List<CustomerSupplierRelation> listBySupplierId(String supplierId);

    List<CustomerSupplierRelation> listByRelationType(String relationType);

    CustomerSupplierRelation getById(String relationId);

    void save(CustomerSupplierRelation relation);

    void update(String relationId, CustomerSupplierRelation relation);

    void delete(String relationId);

    void updateTransaction(String relationId, Integer count, Double amount);
}