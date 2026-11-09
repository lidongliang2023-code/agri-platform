package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 加工记录（采收之后的真实工序：预冷 / 分选 / 分级 / 烘干 / 分装 / 净切）。
 *
 * <p>建在生产域而不是商城侧：溯源码与采收批次都归生产域，"一物一码可溯源"要能被任何人核验。
 * 加工环节若只写在商品详情里，就只是卖家自述 —— 核验端拿不到，链上存证也挂不上业务键。</p>
 *
 * <p>可选字段一律 {@code FieldStrategy.IGNORED}：编辑整表单保存时，清空工艺参数或结束时间
 * 要真的清掉；默认的 NOT_NULL 策略会跳过 null，旧值静默保留（本地已有两处因此翻车）。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_process_record")
public class ProcessRecord extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 加工单号（PR+日期+4 位随机）。租户内唯一，由服务层判重（本表软删，不建唯一键）。 */
    @TableField("process_code")
    private String processCode;

    /** 采收批次主键（agri_prod_harvest_batch.id） */
    @TableField("batch_id")
    private Long batchId;

    /** 采收批次号（冗余，链路节点与存证对号用） */
    @TableField("batch_no")
    private String batchNo;

    /** 加工类型，词表见 ProcessServiceImpl#PROCESS_TYPES */
    @TableField("process_type")
    private String processType;

    /** 工序名称（展示用） */
    @TableField(value = "process_name", updateStrategy = FieldStrategy.IGNORED)
    private String processName;

    /** 加工场地/车间 */
    @TableField(value = "location", updateStrategy = FieldStrategy.IGNORED)
    private String location;

    /** 操作人/负责人 */
    @TableField(value = "operator_name", updateStrategy = FieldStrategy.IGNORED)
    private String operatorName;

    @TableField(value = "started_at", updateStrategy = FieldStrategy.IGNORED)
    private LocalDateTime startedAt;

    @TableField(value = "finished_at", updateStrategy = FieldStrategy.IGNORED)
    private LocalDateTime finishedAt;

    @TableField(value = "input_quantity", updateStrategy = FieldStrategy.IGNORED)
    private BigDecimal inputQuantity;

    @TableField(value = "input_unit", updateStrategy = FieldStrategy.IGNORED)
    private String inputUnit;

    @TableField(value = "output_quantity", updateStrategy = FieldStrategy.IGNORED)
    private BigDecimal outputQuantity;

    @TableField(value = "output_unit", updateStrategy = FieldStrategy.IGNORED)
    private String outputUnit;

    /** 工艺参数（温度/时长/配比等，照实记的纯文本） */
    @TableField(value = "process_params", updateStrategy = FieldStrategy.IGNORED)
    private String processParams;

    /** 现场凭证图片（JSON 数组字符串；null 就是没拍，不编） */
    @TableField(value = "photos", updateStrategy = FieldStrategy.IGNORED)
    private String photos;

    /** DOING 进行中 / DONE 已完成 / CANCELED 已取消 */
    @TableField("status")
    private String status;

    @TableField(value = "remark", updateStrategy = FieldStrategy.IGNORED)
    private String remark;
}
