package com.agri.core.infra.tenant;

import com.agri.shared.result.PageResult;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 租户主体目录。
 *
 * <p>平台按“一个企业或个人经营主体就是一个租户”建模：
 * {@code tenantId == platform_merchant.id}。配额、生产业务数据等只引用该 ID，
 * 不再维护第二套租户主档。</p>
 */
public interface TenantSubjectProvider {

    /** 分页查询经营主体租户。 */
    PageResult<TenantSubject> page(long page, long size, String keyword, Integer status, String memberType);

    /** 查询全部经营主体租户，供平台级概览聚合。 */
    List<TenantSubject> listAll();

    /** 按租户 ID 查询。 */
    TenantSubject findById(Long tenantId);

    /** 更新允许运营维护的主体公开资料与启停状态。 */
    TenantSubject update(Long tenantId, TenantSubjectUpdate update);

    /** 经营主体租户投影。 */
    record TenantSubject(
            Long tenantId,
            String tenantCode,
            String tenantName,
            String memberType,
            String industry,
            String companySize,
            String businessType,
            String address,
            String creditCode,
            String contactName,
            String contactPhone,
            Integer status,
            String verifyStatus,
            String verifyRemark,
            LocalDateTime createdAt,
            CertificationInfo certification,
            IdentityInfo identity) {
    }

    /** 企业认证资料快照。附件地址只用于运营查看，不包含证件明文。 */
    record CertificationInfo(
            String certNo,
            String companyName,
            String creditCode,
            String legalPerson,
            String licenseNo,
            String contactName,
            String contactPhone,
            String attachNote,
            String businessLicenseUrl,
            String legalPersonFaceStatus,
            String corporateBankName,
            String corporateBankAccount,
            String corporateTransferStatus,
            String registeredCapital,
            String verificationChannel,
            String status,
            LocalDateTime submitTime,
            String reviewRemark) {
    }

    /** 个人实名资料。身份证号仅保留服务端生成的掩码。 */
    record IdentityInfo(
            String identityNo,
            String realName,
            String idNoMasked,
            String validStart,
            String validEnd,
            String contactPhone,
            String address,
            String email,
            String businessType,
            String verificationChannel,
            Boolean policeVerified,
            Boolean livenessVerified,
            String status,
            LocalDateTime submitTime,
            String reviewRemark) {
    }

    /** 运营端可修改字段；主体类型与编码来自注册，不允许在此改写。 */
    record TenantSubjectUpdate(
            String tenantName,
            String industry,
            String companySize,
            String businessType,
            String address,
            String creditCode,
            String contactName,
            String contactPhone,
            Integer status) {
    }
}
