package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_consumer")
public class Consumer {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String nickname;
    private String phone;
    private String avatar;
    private String gender;
    private Integer age;
    private String province;
    private String city;
    private String district;
    private String memberLevel;
    private BigDecimal totalConsume;
    private Integer points;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}