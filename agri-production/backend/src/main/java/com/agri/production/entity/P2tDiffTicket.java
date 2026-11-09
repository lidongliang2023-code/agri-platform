package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 产销差异工单：短装 / 等级降级 / 窗口过期 / 超卖。
 *
 * <p>短装与等级降级的处置责任在生产侧，窗口过期与促销归交易侧；
 * 超卖是系统缺陷，必须为 0。</p>
 */
@Data
@TableName("agri_p2t_diff_ticket")
public class P2tDiffTicket {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("tenant_id")
    private String tenantId;
    @TableField("ticket_no")
    private String ticketNo;
    /** SHORT_SHIP / GRADE_DOWN / WINDOW_EXPIRED / OVERSELL */
    @TableField("diff_type")
    private String diffType;
    @TableField("offer_no")
    private String offerNo;
    @TableField("order_no")
    private String orderNo;
    @TableField("diff_qty")
    private BigDecimal diffQty;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("discovered_at")
    private LocalDateTime discoveredAt;
    /** PRODUCTION / TRADE */
    @TableField("owner_side")
    private String ownerSide;
    /** PENDING / PROCESSING / CLOSED */
    private String status;
    @TableField("handle_way")
    private String handleWay;
    @TableField("handle_remark")
    private String handleRemark;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("handle_time")
    private LocalDateTime handleTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
