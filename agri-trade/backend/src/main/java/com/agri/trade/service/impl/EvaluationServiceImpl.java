package com.agri.trade.service.impl;

import com.agri.trade.entity.Evaluation;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.service.IEvaluationService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class EvaluationServiceImpl extends ServiceImpl<EvaluationMapper, Evaluation> implements IEvaluationService {
}