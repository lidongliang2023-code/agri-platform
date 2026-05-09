package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.CustomerSupplierRelation;
import com.agri.masterdata.mapper.CustomerSupplierRelationMapper;
import com.agri.masterdata.service.IRelationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RelationServiceImpl implements IRelationService {

    private final CustomerSupplierRelationMapper relationMapper;

    @Override
    public List<CustomerSupplierRelation> listByCustomerId(String customerId) {
        return relationMapper.selectByCustomerId(customerId);
    }

    @Override
    public List<CustomerSupplierRelation> listBySupplierId(String supplierId) {
        return relationMapper.selectBySupplierId(supplierId);
    }

    @Override
    public List<CustomerSupplierRelation> listByRelationType(String relationType) {
        return relationMapper.selectByRelationType(relationType);
    }

    @Override
    public CustomerSupplierRelation getById(String relationId) {
        CustomerSupplierRelation relation = relationMapper.selectById(relationId);
        if (relation == null) {
            throw new BusinessException("关系记录不存在");
        }
        return relation;
    }

    @Override
    @Transactional
    public void save(CustomerSupplierRelation relation) {
        CustomerSupplierRelation existing = relationMapper.selectByCustomerAndSupplier(
                relation.getCustomerId(), relation.getSupplierId());
        if (existing != null) {
            throw new BusinessException("该客户供应商关系已存在");
        }

        relation.setStartDate(LocalDateTime.now());
        relation.setTransactionCount(0);
        relation.setTotalAmount(BigDecimal.ZERO);
        relation.setDisputeCount(0);
        relation.setStatus("active");
        relation.setCreateTime(LocalDateTime.now());

        relationMapper.insert(relation);
    }

    @Override
    @Transactional
    public void update(String relationId, CustomerSupplierRelation relation) {
        CustomerSupplierRelation existing = relationMapper.selectById(relationId);
        if (existing == null) {
            throw new BusinessException("关系记录不存在");
        }

        relation.setRelationId(relationId);
        relationMapper.updateById(relation);
    }

    @Override
    @Transactional
    public void delete(String relationId) {
        CustomerSupplierRelation relation = relationMapper.selectById(relationId);
        if (relation == null) {
            throw new BusinessException("关系记录不存在");
        }
        relationMapper.deleteById(relationId);
    }

    @Override
    @Transactional
    public void updateTransaction(String relationId, Integer count, Double amount) {
        CustomerSupplierRelation relation = relationMapper.selectById(relationId);
        if (relation == null) {
            throw new BusinessException("关系记录不存在");
        }

        relation.setTransactionCount(relation.getTransactionCount() + count);
        relation.setTotalAmount(relation.getTotalAmount().add(BigDecimal.valueOf(amount)));

        if (relation.getTransactionCount() > 0) {
            relation.setAvgUnitPrice(relation.getTotalAmount()
                    .divide(BigDecimal.valueOf(relation.getTransactionCount()), 2, BigDecimal.ROUND_HALF_UP));
        }

        relationMapper.updateById(relation);
    }
}