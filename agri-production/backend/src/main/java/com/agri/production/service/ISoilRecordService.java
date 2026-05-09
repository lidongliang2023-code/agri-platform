package com.agri.production.service;

import com.agri.production.entity.SoilRecord;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ISoilRecordService extends IService<SoilRecord> {

    IPage<SoilRecord> queryPage(Page<SoilRecord> page, Long plotId, String healthLevel);

    List<SoilRecord> getRecordsByPlotId(Long plotId);

    List<SoilRecord> getRecordsByHealthLevel(String healthLevel);

    SoilRecord getLatestRecord(Long plotId);
}