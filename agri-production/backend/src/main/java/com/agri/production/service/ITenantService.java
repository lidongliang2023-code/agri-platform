package com.agri.production.service;

import com.agri.production.entity.Tenant;

import java.util.List;

public interface ITenantService {

    Tenant create(Tenant tenant);

    Tenant update(Long id, Tenant tenant);

    void delete(Long id);

    Tenant getById(Long id);

    List<Tenant> listAll();

    List<Tenant> listByStatus(String status);

    Tenant audit(Long id, String auditStatus, String auditComment);

    Tenant updateStatus(Long id, String status);

    long countByStatus(String status);
}
