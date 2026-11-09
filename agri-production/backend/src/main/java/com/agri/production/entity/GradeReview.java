package com.agri.production.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@TableName("agri_prod_grade_review")
public class GradeReview {
 @TableId(type=IdType.AUTO) private Long id;
 private String tenantId;
 private String reviewNo;
 private Long ticketId;
 private String ticketNo;
 private String offerNo;
 private String orderNo;
 private Long batchId;
 private String originalGrade;
 private String reviewedGrade;
 private Long inspectionId;
 private String inspectionNo;
 private String reason;
 private String applicantId;
 private String reviewerId;
 private String reviewRemark;
 private String status;
 private LocalDateTime createTime;
 private LocalDateTime reviewedAt;
 private LocalDateTime consumedAt;
}
