package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 加工记录新增 / 编辑入参（字段对齐「登记加工工序」表单）。
 *
 * <p>批次用编号或主键都行（页面从批次详情进来时手里是 batchNo，从溯源链路进来时是 batchId），
 * 服务层统一换算并校验归属，不接受调用方直接指定租户。</p>
 */
@Data
public class ProcessSaveDTO {

    /** 采收批次：主键或批次号（{@code H20260601}） */
    @NotBlank(message = "采收批次不能为空")
    private String batchId;

    /** 加工类型：PRECOOL / SORTING / GRADING / DRYING / PACKAGING / CUTING */
    @NotBlank(message = "加工类型不能为空")
    private String processType;

    /** 工序名称（展示用） */
    private String processName;

    /** 加工场地/车间 */
    private String location;

    /** 操作人/负责人 */
    private String operatorName;

    /** 开始时间（yyyy-MM-dd HH:mm:ss） */
    private LocalDateTime startedAt;

    /** 结束时间 */
    private LocalDateTime finishedAt;

    private BigDecimal inputQuantity;

    private String inputUnit;

    private BigDecimal outputQuantity;

    private String outputUnit;

    /** 工艺参数（温度/时长/配比等） */
    private String processParams;

    /** 现场凭证图片（JSON 数组字符串） */
    private String photos;

    /** DOING / DONE / CANCELED，不传按 DONE */
    private String status;

    private String remark;
}
