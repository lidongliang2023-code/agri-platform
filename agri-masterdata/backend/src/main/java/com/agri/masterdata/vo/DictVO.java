package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class DictVO {

    private Long id;

    private String dictName;

    private String dictCode;

    private String dictType;

    private Integer status;

    private List<DictItemVO> items;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
