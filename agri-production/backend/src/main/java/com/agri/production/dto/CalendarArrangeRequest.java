package com.agri.production.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 编排快照，不替代作物标准、人员或机具台账。日容量由农场核验后提供。 */
public record CalendarArrangeRequest(String farmId, String requestId, LocalDate weekStart, String source,
        LocalDateTime weatherIssuedAt, String weatherSource, List<DaySupply> days, List<Operation> operations) {
    public record DaySupply(LocalDate date, int people, int machineSlots, boolean rain, boolean strongWind, boolean weatherVerified,
            Double minTemperature, Double greenhouseTemperature, String note) {}
    public record Operation(String key, Long planId, Long stageId, String taskName, String taskType,
            boolean mandatory, int priority, LocalDate earliest, LocalDate latest, int people, int machineSlots,
            Long memberId, String standardRef, String requiredSkill, String skillEvidence,
            boolean greenhouse, boolean weatherSensitive, Double minimumTemperature,
            LocalDate floweringStart, LocalDate floweringEnd, LocalDate harvestDate,
            Integer safetyIntervalDays, String registrationRef) {}
}
