package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyColdChainResource;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * 冷链资源出参（页面 {@code ColdChainResource} 的卡片视图）。
 *
 * <p>映射：{@code resource_id→id}、{@code resource_name→name}、{@code resource_status→status}、
 * {@code contact_name→contact}、{@code contact_phone→phone}、{@code last_maintain_date→lastMaintainDate}。
 * {@code typeLabel} 与 {@code tempRange} 是卡片上直接显示的文案，原样透出。</p>
 */
@Data
public class AdminFsColdChainResourceVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private String id;
    private String name;
    /** vehicle / warehouse */
    private String type;
    /** 冷链车 / 冷库 */
    private String typeLabel;
    private String spec;
    private String tempRange;
    private String city;
    private String district;
    /** idle / busy / offline */
    private String status;
    private BigDecimal rating;
    private String contact;
    private String phone;
    private String lastMaintainDate;

    public static AdminFsColdChainResourceVO of(FoodSafetyColdChainResource entity) {
        if (entity == null) {
            return null;
        }
        AdminFsColdChainResourceVO vo = new AdminFsColdChainResourceVO();
        vo.id = entity.getResourceId();
        vo.name = entity.getResourceName();
        vo.type = entity.getResourceType();
        vo.typeLabel = entity.getTypeLabel();
        vo.spec = entity.getSpec();
        vo.tempRange = entity.getTempRange();
        vo.city = entity.getCity();
        vo.district = entity.getDistrict();
        vo.status = entity.getResourceStatus();
        vo.rating = entity.getRating();
        vo.contact = entity.getContactName();
        vo.phone = entity.getContactPhone();
        vo.lastMaintainDate = entity.getLastMaintainDate() == null ? null : DATE.format(entity.getLastMaintainDate());
        return vo;
    }
}
