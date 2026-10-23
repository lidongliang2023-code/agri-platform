package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Invoice;
import com.agri.trade.mapper.InvoiceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.Map;

/** 运营端发票审核与开票状态推进。 */
@RestController
@RequestMapping("/api/trade/admin/invoice")
@RequiredArgsConstructor
public class AdminInvoiceController {

    private final InvoiceMapper invoiceMapper;

    @GetMapping("/page")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<IPage<Invoice>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String invoiceStatus,
            @RequestParam(required = false) String keyword) {
        Page<Invoice> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Invoice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Invoice::getDelFlag, 0);
        if (invoiceStatus != null && !invoiceStatus.isBlank()) {
            wrapper.eq(Invoice::getInvoiceStatus, invoiceStatus);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(Invoice::getInvoiceNo, keyword)
                    .or().like(Invoice::getOrderNo, keyword)
                    .or().like(Invoice::getBuyerName, keyword)
                    .or().like(Invoice::getTitle, keyword));
        }
        wrapper.orderByDesc(Invoice::getApplyTime);
        return ApiResponse.success(invoiceMapper.selectPage(page, wrapper));
    }

    /**
     * 审核开票申请。只允许从 pending 处理一次；issued 记录开票时间，
     * rejected 保留驳回原因，已处理记录不能重复改写。
     */
    @PostMapping("/{id}/review")
    @Transactional(rollbackFor = Exception.class)
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> review(@PathVariable Long id,
                                       @RequestBody Map<String, String> params) {
        Invoice invoice = invoiceMapper.selectById(id);
        if (invoice == null || Integer.valueOf(1).equals(invoice.getDelFlag())) {
            return ApiResponse.error("发票申请不存在");
        }
        if (!"pending".equals(invoice.getInvoiceStatus())) {
            return ApiResponse.error("该发票申请已经处理过，不能重复审核");
        }
        String status = params.get("status");
        if (!"issued".equals(status) && !"rejected".equals(status)) {
            return ApiResponse.error("审核结果只能是 issued（已开票）或 rejected（已驳回）");
        }
        if ("rejected".equals(status)
                && (params.get("remark") == null || params.get("remark").isBlank())) {
            return ApiResponse.error("驳回时必须填写原因");
        }
        invoice.setInvoiceStatus(status);
        invoice.setIssueTime("issued".equals(status) ? new Date() : null);
        invoice.setRemark(params.get("remark"));
        invoice.setUpdateTime(new Date());
        return invoiceMapper.updateById(invoice) > 0
                ? ApiResponse.success(true)
                : ApiResponse.error("审核失败");
    }
}
