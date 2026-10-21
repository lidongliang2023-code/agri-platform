package com.agri.platform.internal.portal;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

/** 门户物流询价：公开提交，运营端分页查看。 */
@RestController
@RequiredArgsConstructor
public class PortalLogisticsInquiryController {

    private final PortalLogisticsInquiryMapper mapper;

    @PostMapping("/api/v1/public/logistics-inquiries")
    public ApiResponse<PortalLogisticsInquiryEntity> submit(@RequestBody SubmitRequest req) {
        if (req == null || blank(req.getOrigin()) || blank(req.getDestination())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "发货地与收货地不能为空");
        }
        BigDecimal weight;
        try {
            weight = new BigDecimal(req.getWeight());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "货物重量格式不正确");
        }
        if (weight.signum() <= 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "货物重量必须大于 0");
        }
        PortalLogisticsInquiryEntity entity = new PortalLogisticsInquiryEntity();
        entity.setInquiryNo("LG" + System.currentTimeMillis()
                + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
        entity.setOrigin(req.getOrigin().trim());
        entity.setOriginDetail(trim(req.getOriginDetail()));
        entity.setDestination(req.getDestination().trim());
        entity.setDestinationDetail(trim(req.getDestinationDetail()));
        entity.setCargoType(trim(req.getCargoType()));
        entity.setWeight(weight);
        entity.setUnit(trim(req.getUnit()));
        entity.setTruckType(trim(req.getTruckType()));
        entity.setExpectedDate(trim(req.getExpectedDate()));
        entity.setExpectedTime(trim(req.getExpectedTime()));
        entity.setStatus("pending");
        mapper.insert(entity);
        return ApiResponse.ok(entity);
    }

    @GetMapping("/api/v1/admin/logistics-inquiries")
    public ApiResponse<PageResult<PortalLogisticsInquiryEntity>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<PortalLogisticsInquiryEntity> wrapper = new LambdaQueryWrapper<>();
        if (!blank(status)) {
            wrapper.eq(PortalLogisticsInquiryEntity::getStatus, status.trim());
        }
        wrapper.orderByDesc(PortalLogisticsInquiryEntity::getCreatedAt);
        Page<PortalLogisticsInquiryEntity> page = mapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return ApiResponse.ok(new PageResult<>(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String trim(String value) {
        return blank(value) ? null : value.trim();
    }

    @Data
    public static class SubmitRequest {
        private String origin;
        private String originDetail;
        private String destination;
        private String destinationDetail;
        private String cargoType;
        private String weight;
        private String unit;
        private String truckType;
        private String expectedDate;
        private String expectedTime;
    }
}
