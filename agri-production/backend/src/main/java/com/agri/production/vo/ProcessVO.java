package com.agri.production.vo;

import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.ProcessRecord;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** 加工记录出参（页面 {@code ProcessRecord}）。 */
@Data
public class ProcessVO {

    private Long id;

    /** 页面口径主键（字符串） */
    public String getProcessRecordId() {
        return id == null ? null : String.valueOf(id);
    }

    private String processCode;

    private Long batchId;

    private String batchNo;

    /** PRECOOL / SORTING / GRADING / DRYING / PACKAGING / CUTING */
    private String processType;

    /** 加工类型的中文档位（由服务端唯一词表映射，页面不再各自翻译） */
    public String getProcessTypeName() {
        return com.agri.production.service.impl.ProcessServiceImpl.typeLabel(processType);
    }

    private String processName;

    private String location;

    private String operatorName;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    private BigDecimal inputQuantity;

    private String inputUnit;

    private BigDecimal outputQuantity;

    private String outputUnit;

    /**
     * 损耗量：投入减产出。
     *
     * <p>只有两边都填了且单位一致才算，否则为 null —— 拿"没填"编出一个 0 或编出一个百分比，
     * 页面上看着像实测值，其实系统并不知道。</p>
     */
    public BigDecimal getLossQuantity() {
        if (inputQuantity == null || outputQuantity == null) {
            return null;
        }
        if (inputUnit != null && outputUnit != null && !inputUnit.equals(outputUnit)) {
            return null;
        }
        return inputQuantity.subtract(outputQuantity);
    }

    private String processParams;

    private String photos;

    /** DOING / DONE / CANCELED */
    private String status;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /**
     * 由实体构造出参。
     *
     * @param entity 加工记录实体（可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static ProcessVO of(ProcessRecord entity) {
        return BeanCopyUtils.copy(entity, ProcessVO.class);
    }

    /**
     * 批量构造出参。
     *
     * @param list 实体列表（可为 null / 空）
     * @returns 出参列表（入参为 null 时返回空列表）
     */
    public static List<ProcessVO> listOf(List<ProcessRecord> list) {
        return list == null ? List.of() : list.stream().map(ProcessVO::of).toList();
    }
}
