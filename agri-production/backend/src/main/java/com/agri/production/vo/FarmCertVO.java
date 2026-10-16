package com.agri.production.vo;

import com.agri.production.entity.FarmCert;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/** 农场证照出参（页面 FarmCert：certId/farmId/certType/certName/certNo/issuer/issueDate/expireDate/attachUrl/status/createdAt）。 */
@Data
public class FarmCertVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String certId;
    private String farmId;
    private String certType;
    private String certName;
    private String certNo;
    private String issuer;
    private String issueDate;
    private String expireDate;
    private String attachUrl;
    /** 0 作废 1 有效 2 临期 3 过期 */
    private Integer status;
    private String createdAt;

    public static FarmCertVO of(FarmCert entity) {
        if (entity == null) {
            return null;
        }
        FarmCertVO vo = new FarmCertVO();
        vo.certId = entity.getCertId();
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.certType = entity.getCertType();
        vo.certName = entity.getCertName();
        vo.certNo = entity.getCertNo();
        vo.issuer = entity.getIssuer();
        vo.issueDate = entity.getIssueDate() == null ? null : DATE.format(entity.getIssueDate());
        vo.expireDate = entity.getExpireDate() == null ? null : DATE.format(entity.getExpireDate());
        vo.attachUrl = entity.getAttachUrl();
        vo.status = entity.getStatus();
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        return vo;
    }
}
