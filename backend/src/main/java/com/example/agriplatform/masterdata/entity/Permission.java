package com.example.agriplatform.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("sys_permission")
public class Permission {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String code;

    private String url;

    private String method;

    private Long parentId;

    private Integer sortOrder;

    private String icon;

    private Integer type;

    private Integer status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}