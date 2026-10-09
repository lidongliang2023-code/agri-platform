package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 农场合规检查任务（运营端 PRD 6.2 #11：禁限用农资抽查 / 记录缺失督导 / 整改跟踪）。
 *
 * <p>字段口径对齐前端 {@code src/types/approval.ts} 的 {@code ComplianceCheck}
 * 与 {@code supervisionShared.ts} 的 {@code ComplianceTaskItem}，后端不具备的字段
 * 一律保持 {@code null}（前端显示「—」），不编造任何取值。</p>
 *
 * <p>两处列名与 Java 字段名不同（其余列由 map-underscore-to-camel-case 自动映射）：
 * {@code result → check_result}、{@code problem → problem_desc}。
 * 原因：{@code result} / {@code problem} 单独作列名语义不清，且避免与 SQL 关键字混淆。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_farm_compliance_check")
public class FarmComplianceCheckEntity extends ProduceBaseEntity {

    /** 检查编号（业务主键，前端生成 CHK + 时间戳 + 序号） */
    @TableId(value = "check_id", type = IdType.INPUT)
    private String checkId;

    /** 农场ID */
    private String farmId;

    /** 农场名称（冗余，列表展示用） */
    private String farmName;

    /**
     * 检查类型：禁限用农资抽查 / 记录缺失督导 / 常规检查。
     *
     * <p>库内有此列，但前端 {@code ComplianceCheck.tsx#persistTask} 的创建请求体
     * 暂未携带该字段，故新建记录此处可能为 {@code null}（前端页面显示取自本地任务对象，
     * 不受影响）；前端补齐传参即可落库，后端无需改动。</p>
     */
    private String checkType;

    /** 检查项 */
    private String checkItem;

    /** 检查结果 1合规 2限期整改 3严重违规 */
    @TableField("check_result")
    private Integer result;

    /** 问题描述 */
    @TableField("problem_desc")
    private String problem;

    /** 整改要求 */
    private String rectifyRequirement;

    /** 整改期限（yyyy-MM-dd） */
    private LocalDate rectifyDeadline;

    /** 检查人 */
    private String checkerName;

    /** 检查时间 */
    private LocalDateTime checkedAt;

    /** 整改状态 none未进入/pending待整改/processing整改中/rectified已整改/overdue已逾期 */
    private String rectifyStatus;

    /** 整改结果说明 */
    private String rectifyRemark;

    /** 整改凭证附件地址 */
    private String rectifyAttachment;

    /** 整改闭环时间 */
    private LocalDateTime rectifiedAt;
}
