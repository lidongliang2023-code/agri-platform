package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_address_region")
public class AddressRegion extends BaseEntity {

    @TableId(value = "region_id", type = IdType.ASSIGN_ID)
    private String regionId;

    @TableField("region_code")
    private String regionCode;

    @TableField("region_name")
    private String regionName;

    @TableField("parent_code")
    private String parentCode;

    @TableField("level")
    private Integer level;

    @TableField("pinyin")
    private String pinyin;

    @TableField("pinyin_abbr")
    private String pinyinAbbr;

    @TableField("latitude")
    private BigDecimal latitude;

    @TableField("longitude")
    private BigDecimal longitude;

    @TableField("area_code")
    private String areaCode;

    @TableField("postal_code")
    private String postalCode;

    @TableField("status")
    private String status;

    @TableField(exist = false)
    private List<AddressRegion> children;
}