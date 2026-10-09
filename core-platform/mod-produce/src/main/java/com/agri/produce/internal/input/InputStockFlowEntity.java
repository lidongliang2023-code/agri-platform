package com.agri.produce.internal.input;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 投入品库存流水
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_input_stock_flow")
public class InputStockFlowEntity extends ProduceBaseEntity {

    @TableId(value = "flow_id", type = IdType.INPUT)
    private String flowId;

    /** 投入品ID */
    private String inputId;

    /** 仓库ID */
    private String warehouseId;

    /** 流水类型 1入库 2领用 3退回 4盘盈 5盘亏 6报损 */
    private Integer flowType;

    /** 数量（出入库为负/正） */
    private BigDecimal qty;

    /** 批次号 */
    private String batchNo;

    /** 有效期至 */
    private LocalDate expireDate;

    /** 操作人 */
    private String operatorId;

    /** 关联农事任务ID */
    private String relatedTaskId;

    /** 备注 */
    private String remark;
}
