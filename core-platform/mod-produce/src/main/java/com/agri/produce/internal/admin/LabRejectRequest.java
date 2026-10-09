package com.agri.produce.internal.admin;

import lombok.Data;

/**
 * 检测机构准入驳回请求体，对应 {@code POST /api/v1/production/admin/quality/labs/{labId}/reject}。
 *
 * <p>驳回理由是运营在弹窗里手填的（前端 LabManage.tsx 审核弹窗的 {@code remark}）。
 * 之前后端没有驳回端点，这段输入被直接丢掉——只有提示「已驳回」，库里什么都没变。
 * 既然收了用户的输入就必须有地方存（落 {@code prod_quality_lab.reject_reason}），
 * 不能静默丢弃。</p>
 */
@Data
public class LabRejectRequest {

    /** 驳回原因（可选；为空表示运营未填写，此时不覆盖已有原因） */
    private String rejectReason;
}
