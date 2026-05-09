package com.agri.trade.service.impl;

import com.agri.trade.entity.MatchRecord;
import com.agri.trade.mapper.MatchRecordMapper;
import com.agri.trade.service.IMatchRecordService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class MatchRecordServiceImpl extends ServiceImpl<MatchRecordMapper, MatchRecord> implements IMatchRecordService {
}