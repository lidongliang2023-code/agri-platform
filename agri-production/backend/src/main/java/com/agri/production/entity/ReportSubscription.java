package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 报表订阅（用户端「数据分析 → 生产报表」的订阅卡片）。
 *
 * <p>列名为什么按页面契约（period / receivers）而不是方案文档里的 frequency / receiver：
 * 见 schema-mysql.sql 的建表注释。本部署**不写真投递**，last_pushed_at 恒为空。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_report_subscription")
public class ReportSubscription extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("subscribe_id")
    private String subscribeId;

    /** 报表类型 1~5 */
    @TableField("report_type")
    private Integer reportType;

    /** 订阅周期：daily / weekly / monthly / quarterly */
    @TableField("period")
    private String period;

    /** 接收渠道（JSON 数组字符串） */
    @TableField("channels")
    private String channels;

    /** 接收人（JSON 数组字符串） */
    @TableField("receivers")
    private String receivers;

    /** 1 启用 0 停用 */
    @TableField("status")
    private Integer status;

    /** 最近推送时间（本部署无推送通道，恒为空） */
    @TableField("last_pushed_at")
    private LocalDateTime lastPushedAt;
}
