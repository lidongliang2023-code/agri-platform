package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_evaluation")
public class Evaluation {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("evaluation_no")
    private String evaluationNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("order_item_id")
    private Long orderItemId;

    @TableField("evaluator_type")
    private String evaluatorType;

    @TableField("evaluator_id")
    private Long evaluatorId;

    @TableField("evaluator_name")
    private String evaluatorName;

    @TableField("evaluatee_id")
    private Long evaluateeId;

    @TableField("evaluatee_name")
    private String evaluateeName;

    @TableField("rating_overall")
    private BigDecimal ratingOverall;

    @TableField("rating_quality")
    private BigDecimal ratingQuality;

    @TableField("rating_delivery")
    private BigDecimal ratingDelivery;

    @TableField("rating_service")
    private BigDecimal ratingService;

    @TableField("rating_price")
    private BigDecimal ratingPrice;

    @TableField("rating_payment")
    private BigDecimal ratingPayment;

    @TableField("rating_communication")
    private BigDecimal ratingCommunication;

    @TableField("rating_honesty")
    private BigDecimal ratingHonesty;

    @TableField("evaluation_content")
    private String evaluationContent;

    @TableField("evaluation_images")
    private String evaluationImages;

    @TableField("evaluation_tags")
    private String evaluationTags;

    @TableField("reply_content")
    private String replyContent;

    @TableField("reply_time")
    private Date replyTime;

    @TableField("is_anonymous")
    private Integer isAnonymous;

    @TableField("is_system")
    private Integer isSystem;

    @TableField("evaluation_status")
    private String evaluationStatus;

    @TableField("hide_reason")
    private String hideReason;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}