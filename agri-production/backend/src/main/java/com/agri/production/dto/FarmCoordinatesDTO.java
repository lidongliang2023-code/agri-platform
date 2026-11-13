package com.agri.production.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import lombok.Data;
import java.math.BigDecimal;

/** 农场地理坐标；清空必须显式传 clearCoordinates=true，避免普通资料编辑误清空。 */
@Data
public class FarmCoordinatesDTO {
    @DecimalMin(value = "-180", message = "经度必须在 -180 至 180 之间")
    @DecimalMax(value = "180", message = "经度必须在 -180 至 180 之间")
    @Digits(integer = 3, fraction = 8, message = "经度最多保留8位小数")
    private BigDecimal longitude;

    @DecimalMin(value = "-90", message = "纬度必须在 -90 至 90 之间")
    @DecimalMax(value = "90", message = "纬度必须在 -90 至 90 之间")
    @Digits(integer = 2, fraction = 8, message = "纬度最多保留8位小数")
    private BigDecimal latitude;

    private boolean clearCoordinates;

    @JsonIgnore
    @AssertTrue(message = "经纬度须成对填写；清空坐标时请勿同时提交经纬度")
    public boolean isCoordinatePairValid() {
        return clearCoordinates ? longitude == null && latitude == null
            : (longitude == null) == (latitude == null);
    }
}
