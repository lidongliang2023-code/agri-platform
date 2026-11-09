package com.agri.production.controller;
import com.agri.production.common.entity.*;
import com.agri.production.entity.GradeReview;
import com.agri.production.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/production/quality/grade-reviews")
public class GradeReviewController {
 private final GradeReviewService service;
 @GetMapping public ApiResponse<PageResult<GradeReview>> page(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) Long ticketId) {
  return ApiResponse.success(service.page(pageNum,pageSize,ticketId,TenantContextService.currentTenantId()));
 }
 @PostMapping public ApiResponse<GradeReview> apply(@RequestBody GradeReviewService.Apply body) {
  String tenant=TenantContextService.currentTenantId();return ApiResponse.success(service.apply(body,tenant,TenantContextService.currentUserId()));
 }
 @PostMapping("/{id}/decision") public ApiResponse<GradeReview> decide(@PathVariable Long id,@RequestBody GradeReviewService.Decision body) {
  String tenant=TenantContextService.currentTenantId();return ApiResponse.success(service.decide(id,body,tenant,TenantContextService.currentUserId()));
 }
}
