package com.agri.production.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** 独立维护农场范围，不修改农场中心坐标或登记面积。 */
@Data
public class FarmBoundaryDTO {
    @Size(max = 60000, message = "农场边界数据不能超过60000字符")
    private String boundary;
    private boolean clearBoundary;
}
