package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 生产报表（用户端「数据分析 → 生产报表」）。
 *
 * <p>类名用 ProductionReport 而不是 Report：{@code Report} 这类通用名在平台/通用包里到处都是，
 * import 错的后果是"编译通过、字段全空"（TeamMember 那边踩过同一个坑）。</p>
 *
 * <p>列的口径与为什么这么定写在 schema-mysql.sql 的建表注释里。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_report")
public class ProductionReport extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 报表编号（业务主键，页面 reportId） */
    @TableField("report_id")
    private String reportId;

    @TableField("report_name")
    private String reportName;

    /** 1 日报 / 2 周报 / 3 月报 / 4 季报 / 5 年报 */
    @TableField("report_type")
    private Integer reportType;

    /** 周期标签（页面 period；由类型 + 生成入参的日期推导） */
    @TableField("period")
    private String period;

    @TableField("period_start")
    private LocalDate periodStart;

    @TableField("period_end")
    private LocalDate periodEnd;

    /** 1 生成中 / 2 已完成 / 3 失败（本实现同步聚合，落库即 2） */
    @TableField("status")
    private Integer status;

    /** 聚合快照（JSON） */
    @TableField("summary_json")
    private String summaryJson;

    @TableField("file_url")
    private String fileUrl;

    @TableField("file_size")
    private Long fileSize;

    /** 导出下载令牌（window.open 带不了 Authorization 头） */
    @TableField("download_key")
    private String downloadKey;

    @TableField("generated_at")
    private LocalDateTime generatedAt;

    /** 生成人（本服务拿不到平台用户档案，暂为空） */
    @TableField("generated_by")
    private String generatedBy;

    @TableField("remark")
    private String remark;
}
