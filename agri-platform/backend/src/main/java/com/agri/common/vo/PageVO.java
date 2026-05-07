package com.agri.common.vo;

import lombok.Data;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

@Data
public class PageVO {

    @Min(value = 1, message = "页码最小值为1")
    private Integer pageNum = 1;

    @Min(value = 1, message = "每页条数最小值为1")
    @Max(value = 100, message = "每页条数最大值为100")
    private Integer pageSize = 10;

    private String orderBy;

    private String sortOrder = "desc";

    public void setPageSize(Integer pageSize) {
        if (pageSize != null && pageSize > 0) {
            this.pageSize = Math.min(pageSize, 100);
        } else {
            this.pageSize = 10;
        }
    }

    public void setPageNum(Integer pageNum) {
        if (pageNum != null && pageNum > 0) {
            this.pageNum = pageNum;
        } else {
            this.pageNum = 1;
        }
    }
}
