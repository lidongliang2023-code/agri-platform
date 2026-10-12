package com.agri.common.result;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> implements Serializable {

    private List<T> records;
    private List<T> list;
    private Long total;
    private Long pageNum;
    private Long pageSize;
    private Long pages;

    public PageResult(List<T> records, long total) {
        this.records = records;
        this.list = records;
        this.total = total;
        this.pageSize = 10L;
        this.pageNum = 1L;
        this.pages = (total + this.pageSize - 1) / this.pageSize;
    }

    public PageResult(List<T> records, long total, long pageNum, long pageSize) {
        this.records = records;
        this.list = records;
        this.total = total;
        this.pageNum = pageNum;
        this.pageSize = pageSize;
        this.pages = (total + pageSize - 1) / pageSize;
    }

    public static <T> PageResult<T> of(List<T> records, long total) {
        return new PageResult<>(records, total);
    }

    public static <T> PageResult<T> of(List<T> records, long total, long pageNum, long pageSize) {
        return new PageResult<>(records, total, pageNum, pageSize);
    }

    public static <T> PageResult<T> empty(long pageNum, long pageSize) {
        return new PageResult<>(List.of(), 0, pageNum, pageSize);
    }
}
