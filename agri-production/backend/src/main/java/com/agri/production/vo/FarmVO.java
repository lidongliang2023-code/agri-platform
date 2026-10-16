package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class FarmVO {

    private Long id;

    private String farmCode;

    private String farmName;

    private String farmType;

    private String legalPerson;

    private String contactPhone;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private BigDecimal totalArea;

    private Integer plotCount;

    private String farmTypeDetail;

    private String mainProducts;

    private String certifications;

    private LocalDate certificationExpireDate;

    private String certificationsJson;

    private String logoUrl;

    private String intro;

    private LocalDate registerDate;

    private String auditStatus;

    private String status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    /**
     * 农场负责人姓名（页面 farm list 的"负责人"列）。

     *
     * <p>平台侧没有这一列：本服务在出参处从团队成员台账里取该农场的 {@code member_type=OWNER}
     * （见 FarmAllController 的说明）。取不到时留空，页面显示 "-" —— 不编一个名字。</p>
     */
    private String managerName;

    /**
     * 页面口径的农场主键（字符串）—— 页面列表直接读 {@code record.farmId}，而本 VO 的主键字段叫 {@code id}。
     * 派生 getter，理由同 {@link PlotVO#getPlotId()}。
     */
    public String getFarmId() {
        return id == null ? null : String.valueOf(id);
    }

    /**
     * 页面口径的在册面积字段名（{@code areaTotal}）；库里/本 VO 叫 {@code totalArea}。
     *
     * <p>只做改名别名，不做换算：页面要的就是"农场在册总面积"这一个数。</p>
     */
    public java.math.BigDecimal getAreaTotal() {
        return totalArea;
    }

    /**
     * 页面口径的联系电话（{@code managerPhone}）：落库列是 {@code contact_phone}，这里给别名。
     * 理由同 {@code areaTotal} —— 页面读的是它自己的字段名。
     */
    public String getManagerPhone() {
        return getContactPhone();
    }

    private LocalDateTime updateTime;
}
