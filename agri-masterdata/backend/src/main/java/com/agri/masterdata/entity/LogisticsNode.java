package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("agri_md_logistics_node")
public class LogisticsNode {

    @TableId(value = "node_id", type = IdType.ASSIGN_ID)
    private String nodeId;

    @TableField("node_code")
    private String nodeCode;

    @TableField("node_name")
    private String nodeName;

    @TableField("node_type")
    private String nodeType;

    @TableField("region_code")
    private String regionCode;

    @TableField("address")
    private String address;

    @TableField("longitude")
    private BigDecimal longitude;

    @TableField("latitude")
    private BigDecimal latitude;

    @TableField("capacity")
    private String capacity;

    @TableField("services")
    private String services;

    @TableField("contact_person")
    private String contactPerson;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("status")
    private String status;
}