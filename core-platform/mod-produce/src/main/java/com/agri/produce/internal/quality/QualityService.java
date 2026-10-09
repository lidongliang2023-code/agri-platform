package com.agri.produce.internal.quality;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
import com.agri.produce.internal.batch.BatchEntity;
import com.agri.produce.internal.batch.BatchMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 质检服务：登记报告；合格 → 发布 quality.test.passed（交易域可信标识、政务监管报送的数据底座）。
 */
@Service
@RequiredArgsConstructor
public class QualityService {

    private final QualityReportMapper reportMapper;
    private final BatchMapper batchMapper;
    private final DomainEventPublisher eventPublisher;

    @Transactional
    public QualityReportEntity report(Long batchId, String item, boolean pass) {
        BatchEntity batch = batchMapper.selectById(batchId);
        if (batch == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        QualityReportEntity report = new QualityReportEntity();
        report.setBatchId(batchId);
        report.setReportNo("QR" + DateTimeFormatter.ofPattern("yyyyMMdd").format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(100000, 999999));
        report.setItem(item);
        report.setResult(pass ? "PASS" : "FAIL");
        report.setTestedAt(LocalDateTime.now());
        reportMapper.insert(report);

        if (pass) {
            eventPublisher.publish(ProduceEvents.QUALITY_TEST_PASSED, report.getReportNo(),
                    new ProduceEvents.QualityTestPassed(batch.getId(), batch.getBatchCode(),
                            report.getReportNo(), item, batch.getMarketId(), report.getTestedAt().toString()));
        }
        return report;
    }

    public java.util.List<QualityReportEntity> listByBatch(Long batchId) {
        return reportMapper.selectList(new LambdaQueryWrapper<QualityReportEntity>()
                .eq(QualityReportEntity::getBatchId, batchId)
                .orderByDesc(QualityReportEntity::getTestedAt));
    }
}
