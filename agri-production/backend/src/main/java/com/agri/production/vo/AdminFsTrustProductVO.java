package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyTrustProduct;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 可信农产品出参（页面 {@code TrustProduct}）。
 *
 * <p>映射：{@code product_id→id}、{@code product_name→name}、{@code trust_level→level}、
 * {@code trust_score→score}、{@code cert_mark→cert}、{@code valid_until→validUntil}。
 * 页面按 level/cert/auditStatus 的英文字面量做颜色与文案映射，这三个字段原样透出。</p>
 */
@Data
public class AdminFsTrustProductVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private String id;
    private String name;
    private String category;
    private String producer;
    /** diamond / gold / silver / normal */
    private String level;
    /** 信任分数 0~100 */
    private Integer score;
    /** organic / green / pollution-free / none */
    private String cert;
    /** yyyy-MM-dd；认证标志为 none 时为 null */
    private String validUntil;
    /** approved / pending / rejected */
    private String auditStatus;
    private String certOrg;

    public static AdminFsTrustProductVO of(FoodSafetyTrustProduct entity) {
        if (entity == null) {
            return null;
        }
        AdminFsTrustProductVO vo = new AdminFsTrustProductVO();
        vo.id = entity.getProductId();
        vo.name = entity.getProductName();
        vo.category = entity.getCategory();
        vo.producer = entity.getProducer();
        vo.level = entity.getTrustLevel();
        vo.score = entity.getTrustScore();
        vo.cert = entity.getCertMark();
        vo.validUntil = entity.getValidUntil() == null ? null : DATE.format(entity.getValidUntil());
        vo.auditStatus = entity.getAuditStatus();
        vo.certOrg = entity.getCertOrg();
        return vo;
    }
}
