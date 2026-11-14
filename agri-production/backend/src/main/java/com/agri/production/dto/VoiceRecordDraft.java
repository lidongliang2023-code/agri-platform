package com.agri.production.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 已发生作业的事实草稿；不生成农事任务或用药处方。单位只接受标准单位。 */
public record VoiceRecordDraft(Long plotId, Long batchId, String operationType, LocalDateTime operatedAt,
        Long operatorId, BigDecimal areaMu, Long inputId, BigDecimal quantity, String unit,
        BigDecimal durationHours, String description, String evidenceRef, BigDecimal registeredMaxPerMu,
        Integer safetyIntervalDays) {}
