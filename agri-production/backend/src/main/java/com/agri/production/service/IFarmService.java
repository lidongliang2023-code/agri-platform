package com.agri.production.service;

import com.agri.production.entity.Farm;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IFarmService extends IService<Farm> {

    IPage<Farm> queryPage(Page<Farm> page, String farmName, String farmType, String auditStatus);

    List<Farm> getActiveFarms();

    List<Farm> getFarmsByType(String farmType);

    List<Farm> getFarmsByAuditStatus(String auditStatus);

    boolean auditFarm(Long id, String auditStatus, String auditComment, String auditor);

    boolean updateFarmStatus(Long id, String status);
}