package com.agri.masterdata.controller.publics;

import com.agri.admin.service.AnnouncementService;
import com.agri.common.entity.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 官网门户公开只读接口。
 *
 * <p>门户是匿名浏览的公开站点，而主数据其余接口都挂在认证拦截器后面
 * （{@code /api/user/announcements} 要求登录）。公告本身是运营在公告管理里「发布」给全平台看的，
 * 再要求登录等于门户上根本没有这一栏——首页此前只能退回前端写死的公告文案。</p>
 *
 * <p>该前缀在 {@code WebMvcConfig.PUBLIC_PATHS} 中显式放行，是本模块唯一的匿名业务读入口，
 * 只开放<b>已发布且未到期</b>公告的展示字段；草稿与已下线公告不会从这里流出。</p>
 */
@RestController
@RequestMapping("/api/master-data/public")
@RequiredArgsConstructor
public class PortalPublicController {

    private final AnnouncementService announcementService;

    /** 门户公告块：与用户端公告中心同一份查询与出参形状。 */
    @GetMapping("/announcements")
    public ApiResponse<List<Map<String, Object>>> announcements(@RequestParam(defaultValue = "5") Integer limit) {
        return ApiResponse.success(announcementService.publishedViews(limit));
    }
}
