package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 行业标准校验项明细（P17 Tab3）。
 *
 * <p>{@code check_time} 是 P15「检测项达标率」及其环比的唯一数据来源，
 * 故建索引 {@code idx_fs_std_item_time}。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_standard_item")
public class StandardItemEntity extends ProduceBaseEntity {

    /** 校验项ID（业务主键，JSON 字段名 id） */
    @TableId(value = "item_id", type = IdType.INPUT)
    private String id;

    /** 所属标准编号 */
    private String standardNo;

    /** 校验项名称，如 铅（以 Pb 计） */
    private String itemName;

    /** 标准限值文案，如 ≤ 0.2 mg/kg */
    private String limitValue;

    /** 实测值文案，如 0.08 mg/kg */
    private String measuredValue;

    /** 结论：pass / fail */
    @TableField("check_result")
    private String result;

    /** 抽检批次号 */
    private String batchNo;

    /** 抽检时间（当期/上期达标率按此分组） */
    private LocalDateTime checkTime;
}
