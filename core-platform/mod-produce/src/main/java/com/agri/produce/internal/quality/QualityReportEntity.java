package com.agri.produce.internal.quality;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 质量检测报告（食品安全 · 检测管理 MVP）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_quality_report")
public class QualityReportEntity extends BaseEntity {

    private Long batchId;
    private String reportNo;
    /** 检测项，如 农药残留 */
    private String item;
    /** PASS / FAIL */
    private String result;
    private LocalDateTime testedAt;
}
