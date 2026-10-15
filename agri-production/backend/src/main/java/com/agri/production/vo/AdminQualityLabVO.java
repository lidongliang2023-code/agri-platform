package com.agri.production.vo;

import com.agri.production.entity.TestingLab;
import lombok.Data;

/**
 * 运营端检测机构出参（前端 {@code QualityLab}，见 api/admin/trace.ts）。
 *
 * <p><b>为什么不直接返回 {@link TestingLab} 实体</b>：页面读的是 {@code qualificationNo}，
 * 而本服务的列/字段叫 {@code certNo} —— 直接返实体的话，运营端"资质编号"一列会显示成 "—"，
 * 而库里明明有这个值。这类"字段名差一点、值就静默丢了"的坑本轮已经遇到三次
 * （bizNo/bizId、farmId、queryCount/scanCount），所以这里按页面要的名字出参。</p>
 *
 * <p>取值为 null 的三个字段（{@code labType} / {@code address} / {@code accreditedScope}）
 * 是**本服务确实没有这些列**，不是漏映射：留成显式的 null，页面渲染 "—"，
 * 免得将来有人以为是接口没返回。</p>
 */
@Data
public class AdminQualityLabVO {

    private Long labId;
    private String labCode;
    private String labName;
    /** 机构类型：本服务没有这一列 → 恒为 null */
    private String labType;
    /** 资质等级：1 国家级 / 2 省级 / 3 市级 */
    private Integer labLevel;
    private String contactName;
    private String contactPhone;
    /** 机构地址：本服务没有这一列 → 恒为 null（表里与之相近的是 region，单独出参） */
    private String address;
    private String region;
    /** 资质证书编号（= 实体 cert_no） */
    private String qualificationNo;
    /** 认可检测范围：本服务没有这一列 → 恒为 null */
    private String accreditedScope;
    /** 1 合作中 / 2 待准入 / 0 已终止 */
    private Integer status;
    /** 准入驳回原因（驳回时落库；未驳回过为 null） */
    private String rejectReason;
    private String remark;
    private String createdAt;
    private String updatedAt;

    public static AdminQualityLabVO of(TestingLab entity) {
        if (entity == null) {
            return null;
        }
        AdminQualityLabVO vo = new AdminQualityLabVO();
        vo.labId = entity.getLabId();
        vo.labCode = entity.getLabCode();
        vo.labName = entity.getLabName();
        vo.labType = null;
        vo.labLevel = entity.getLabLevel();
        vo.contactName = entity.getContactName();
        vo.contactPhone = entity.getContactPhone();
        vo.address = null;
        vo.region = entity.getRegion();
        vo.qualificationNo = entity.getCertNo();
        vo.accreditedScope = null;
        vo.status = entity.getStatus();
        vo.rejectReason = entity.getRejectReason();
        vo.remark = entity.getRemark();
        vo.createdAt = entity.getCreateTime() == null ? null : entity.getCreateTime().toString().replace('T', ' ');
        vo.updatedAt = entity.getUpdateTime() == null ? null : entity.getUpdateTime().toString().replace('T', ' ');
        return vo;
    }
}
