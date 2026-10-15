package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 食品安全-投入品合规台账（P17 Tab1）。
 *
 * <p>主键沿用平台的**业务编号** {@code record_id}（前端契约里的 id 就是它）。</p>
 *
 * <p>{@code farm_id} 在本表是 <b>varchar</b>（引用农场业务编号），不是数字主键 ——
 * 所以这里不能继承 {@code BaseEntity}：基类把 farm_id 声明成 Long 并按插入自动填充，
 * 在这张表上会把演示数据的 "1" 当成数字处理，也会凭空插入一个不属于本行的农场。</p>
 */
@Data
@TableName("agri_prod_fs_input_compliance")
public class FoodSafetyInputCompliance {

    @TableId(value = "record_id", type = IdType.INPUT)
    private String recordId;

    @TableField("tenant_id")
    private String tenantId;

    /** 农场编号（varchar，指向农场业务编号） */
    @TableField("farm_id")
    private String farmId;

    @TableField("farm_name")
    private String farmName;

    @TableField("input_name")
    private String inputName;

    /** 氮肥/磷肥/钾肥/农药/杀菌剂/除草/调节剂/有机肥 */
    @TableField("input_type")
    private String inputType;

    /** 用量文案，如 20kg/亩 */
    @TableField("dosage")
    private String dosage;

    /** pass 合规 / over 超标 */
    @TableField("check_result")
    private String checkResult;

    /** 违规项描述（无违规为 NULL；处罚登记会把处理痕迹追加到这里） */
    @TableField("violation")
    private String violation;

    @TableField("check_date")
    private LocalDate checkDate;

    @TableField("punish_action")
    private String punishAction;

    @TableField("punish_amount")
    private BigDecimal punishAmount;

    @TableField("punish_remark")
    private String punishRemark;

    @TableField("punish_time")
    private LocalDateTime punishTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
