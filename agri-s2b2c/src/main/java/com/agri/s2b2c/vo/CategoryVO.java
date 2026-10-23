package com.agri.s2b2c.vo;

import lombok.Data;

import java.util.List;

@Data
public class CategoryVO {
    private Long id;
    private String name;
    private String icon;
    private Integer level;
    private List<CategoryVO> children;
}