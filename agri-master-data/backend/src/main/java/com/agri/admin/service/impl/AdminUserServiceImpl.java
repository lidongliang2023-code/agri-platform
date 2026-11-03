package com.agri.admin.service.impl;

import com.agri.admin.dto.UserImportDTO;
import com.agri.admin.client.CoreUserAdminClient;
import com.agri.admin.service.IAdminUserService;
import com.agri.admin.vo.UserAuditVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.entity.*;
import com.agri.masterdata.mapper.*;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.UserVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements IAdminUserService {

    private final IUserService userService;
    private final UserMapper userMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;
    private final TenantMapper tenantMapper;
    private final CoreUserAdminClient coreUserAdminClient;

    @Override
    public PageResult<UserVO> getUserList(Integer pageNum, Integer pageSize, String username, String phone, String email, String userType, String realNameStatus, String userStatus, String tenantId) {
        List<UserVO> all = loadUnifiedUsers();
        String keyword = username == null ? null : username.trim().toLowerCase(Locale.ROOT);
        String phoneFilter = phone == null ? null : phone.trim();
        String emailFilter = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        String typeFilter = normalize(userType);
        String verifyFilter = normalize(realNameStatus);
        String statusFilter = normalizeUserStatus(userStatus);
        String subjectFilter = normalize(tenantId);

        List<UserVO> filtered = all.stream()
                .filter(user -> keyword == null || keyword.isBlank()
                        || contains(user.getUsername(), keyword)
                        || contains(user.getNickName(), keyword)
                        || contains(user.getPhone(), keyword)
                        || contains(user.getEmail(), keyword)
                        || contains(user.getOrgName(), keyword))
                .filter(user -> phoneFilter == null || phoneFilter.isBlank()
                        || contains(user.getPhone(), phoneFilter))
                .filter(user -> emailFilter == null || emailFilter.isBlank()
                        || contains(user.getEmail(), emailFilter))
                .filter(user -> typeFilter == null
                        || matchesMembership(user, typeFilter, null))
                .filter(user -> verifyFilter == null
                        || matchesMembership(user, null, verifyFilter))
                .filter(user -> subjectFilter == null
                        || user.getMemberships().stream().anyMatch(item -> subjectFilter.equals(
                                String.valueOf(item.getSubjectId()))))
                .filter(user -> statusFilter == null || statusFilter.equals(user.getUserStatus()))
                .toList();

        int from = Math.max(0, (pageNum - 1) * pageSize);
        int to = Math.min(filtered.size(), from + pageSize);
        List<UserVO> pageRecords = from >= filtered.size() ? List.of() : filtered.subList(from, to);
        return new PageResult<>(new ArrayList<>(pageRecords), (long) filtered.size(),
                pageNum.longValue(), pageSize.longValue());
    }

    @Override
    public UserVO getUserDetail(Long id) {
        return loadUnifiedUsers().stream()
                .filter(user -> id.equals(user.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("统一用户不存在"));
    }

    @Override
    public void createUser(UserSaveDTO dto) {
        throw new BusinessException("请在统一认证中心注册账号；主数据端不再创建平行用户");
    }

    @Override
    public void updateUser(Long id, UserUpdateDTO dto) {
        throw new BusinessException("账号资料请在个人中心维护；主数据端不再写入平行用户");
    }

    @Override
    public void deleteUser(Long id) {
        throw new BusinessException("统一用户不允许删除；可停用账号或解除主体绑定");
    }

    @Override
    public void updateUserStatus(Long id, String userStatus) {
        String normalized = normalizeUserStatus(userStatus);
        if (normalized == null) {
            throw new BusinessException("用户状态只能是 active/inactive 或 1/0");
        }
        CoreUserAdminClient.CoreApiResponse<Void> response = coreUserAdminClient.updateStatus(
                id, new CoreUserAdminClient.UserStatusUpdate("active".equals(normalized) ? 1 : 0));
        if (response.code() == null || response.code() != 0) {
            throw new BusinessException(response.message() == null
                    ? "统一用户状态更新失败" : response.message());
        }
    }

    private List<UserVO> loadUnifiedUsers() {
        List<CoreUserAdminClient.CoreUser> users = new ArrayList<>();
        long page = 1;
        long size = 500;
        while (true) {
            CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<CoreUserAdminClient.CoreUser>> response =
                    coreUserAdminClient.pageUsers(page, size, null);
            requireCoreSuccess(response.code(), response.message());
            CoreUserAdminClient.CorePage<CoreUserAdminClient.CoreUser> data = response.data();
            if (data == null || data.records() == null || data.records().isEmpty()) {
                break;
            }
            users.addAll(data.records());
            if (users.size() >= data.total()) {
                break;
            }
            page++;
        }

        List<CoreUserAdminClient.CoreMembership> memberships = new ArrayList<>();
        page = 1;
        size = 500;
        while (true) {
            CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<CoreUserAdminClient.CoreMembership>> response =
                    coreUserAdminClient.pageMemberships(page, size);
            requireCoreSuccess(response.code(), response.message());
            CoreUserAdminClient.CorePage<CoreUserAdminClient.CoreMembership> data = response.data();
            if (data == null || data.records() == null || data.records().isEmpty()) {
                break;
            }
            memberships.addAll(data.records());
            if (memberships.size() >= data.total()) {
                break;
            }
            page++;
        }

        Map<Long, List<CoreUserAdminClient.CoreMembership>> byUser = new HashMap<>();
        for (CoreUserAdminClient.CoreMembership membership : memberships) {
            if (Integer.valueOf(1).equals(membership.status())) {
                byUser.computeIfAbsent(membership.userId(), key -> new ArrayList<>()).add(membership);
            }
        }

        return users.stream()
                .sorted(Comparator.comparing(CoreUserAdminClient.CoreUser::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(user -> toUnifiedUser(user, byUser.getOrDefault(user.id(), List.of())))
                .toList();
    }

    private UserVO toUnifiedUser(CoreUserAdminClient.CoreUser user,
                                 List<CoreUserAdminClient.CoreMembership> memberships) {
        List<UserVO.Membership> subjects = memberships.stream()
                .map(item -> UserVO.Membership.builder()
                        .bindingId(item.id())
                        .subjectId(item.merchantId())
                        .subjectName(item.merchantName())
                        .memberType(item.memberType())
                        .roleInMerchant(item.roleInMerchant())
                        .verifyStatus(item.verifyStatus())
                        .status(item.status())
                        .build())
                .toList();
        Set<String> memberTypes = memberships.stream()
                .map(CoreUserAdminClient.CoreMembership::memberType)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        String userType = memberTypes.size() == 1 ? memberTypes.iterator().next()
                : memberTypes.size() > 1 ? "mixed" : null;
        String realNameStatus = aggregateVerifyStatus(memberships);
        LocalDateTime createdAt = parseTime(user.createdAt());
        return UserVO.builder()
                .id(user.id())
                .userCode("PU" + user.id())
                .username(user.username())
                .realName(user.nickname())
                .nickName(user.nickname())
                .phone(user.phone())
                .email(user.email())
                .userType(userType)
                .userStatus(Integer.valueOf(1).equals(user.status()) ? "active" : "inactive")
                .realNameStatus(realNameStatus)
                .status(user.status())
                .tenantId(memberships.isEmpty() ? null : String.valueOf(memberships.get(0).merchantId()))
                .orgName(joinSubjectNames(memberships))
                .roleNames(memberships.stream().map(CoreUserAdminClient.CoreMembership::roleInMerchant)
                        .filter(value -> value != null && !value.isBlank())
                        .distinct().toList())
                .memberships(new ArrayList<>(subjects))
                .createTime(createdAt)
                .updateTime(parseTime(user.updatedAt()))
                .build();
    }

    private static String joinSubjectNames(List<CoreUserAdminClient.CoreMembership> memberships) {
        String names = memberships.stream()
                .map(CoreUserAdminClient.CoreMembership::merchantName)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .collect(Collectors.joining("、"));
        return names.isBlank() ? null : names;
    }

    private static String aggregateVerifyStatus(List<CoreUserAdminClient.CoreMembership> memberships) {
        Set<String> statuses = memberships.stream()
                .map(CoreUserAdminClient.CoreMembership::verifyStatus)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.toSet());
        if (statuses.contains("approved")) return "approved";
        if (statuses.contains("pending")) return "pending";
        if (statuses.contains("rejected")) return "rejected";
        return "unverified";
    }

    private static boolean matchesMembership(UserVO user, String memberType, String verifyStatus) {
        return user.getMemberships() != null && user.getMemberships().stream().anyMatch(item ->
                (memberType == null || memberType.equals(normalize(item.getMemberType())))
                        && (verifyStatus == null || verifyStatus.equals(normalize(item.getVerifyStatus()))));
    }

    private static boolean contains(String source, String needle) {
        return source != null && source.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeUserStatus(String value) {
        String normalized = normalize(value);
        if (normalized == null) return null;
        if ("1".equals(normalized) || "active".equals(normalized) || "enabled".equals(normalized)) {
            return "active";
        }
        if ("0".equals(normalized) || "inactive".equals(normalized) || "disabled".equals(normalized)) {
            return "inactive";
        }
        return normalized;
    }

    private static LocalDateTime parseTime(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().replace('T', ' ');
        return normalized.length() > 19
                ? LocalDateTime.parse(normalized.substring(0, 19),
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : LocalDateTime.parse(normalized, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private static void requireCoreSuccess(Integer code, String message) {
        if (code == null || code != 0) {
            throw new BusinessException(message == null || message.isBlank()
                    ? "统一用户服务暂不可用" : message);
        }
    }

    @Override
    public PageResult<UserAuditVO> getCertAuditList(Integer pageNum, Integer pageSize, String authStatus) {
        IPage<UserAuthentication> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<UserAuthentication> wrapper = new LambdaQueryWrapper<>();
        
        if (authStatus != null && !authStatus.isEmpty()) {
            wrapper.eq(UserAuthentication::getAuthStatus, authStatus);
        }
        
        page = userAuthenticationMapper.selectPage(page, wrapper);
        
        List<UserAuditVO> records = new ArrayList<>();
        for (UserAuthentication auth : page.getRecords()) {
            UserAuditVO vo = new UserAuditVO();
            vo.setId(auth.getId());
            try {
                vo.setUserId(auth.getUserId() != null ? Long.parseLong(auth.getUserId()) : null);
            } catch (NumberFormatException e) {
                vo.setUserId(null);
            }
            vo.setAuthType(auth.getAuthType());
            vo.setAuthStatus(auth.getAuthStatus());
            vo.setAuthData(auth.getAuthData());
            vo.setCreateTime(auth.getCreateTime() != null ? auth.getCreateTime().toString() : null);
            
            User user = userMapper.selectById(auth.getUserId());
            if (user != null) {
                vo.setUsername(user.getUsername());
                vo.setRealName(user.getRealName());
                vo.setPhone(user.getPhone());
                vo.setIdCardType(user.getIdCardType());
                vo.setIdCardNo(user.getIdCardNo());
                vo.setTenantId(user.getTenantId());
                
                if (user.getTenantId() != null && !user.getTenantId().isEmpty()) {
                    try {
                        Tenant tenant = tenantMapper.selectById(Long.parseLong(user.getTenantId()));
                        if (tenant != null) {
                            vo.setTenantName(tenant.getTenantName());
                        }
                    } catch (NumberFormatException e) {
                    }
                }
            }
            
            records.add(vo);
        }
        
        return new PageResult<>(records, page.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public void reviewCert(Long id, UserAuthReviewDTO dto) {
        UserAuthentication auth = userAuthenticationMapper.selectById(id);
        if (auth == null) {
            throw new BusinessException("认证记录不存在");
        }
        
        auth.setAuthStatus(dto.getAuthStatus());
        auth.setAuditNote(dto.getAuditNote());
        auth.setAuditBy("admin");
        auth.setAuditTime(LocalDateTime.now());
        userAuthenticationMapper.updateById(auth);
        
        if ("approved".equals(dto.getAuthStatus())) {
            User user = userMapper.selectById(auth.getUserId());
            if (user != null) {
                user.setRealNameStatus("verified");
                userMapper.updateById(user);
            }
        }
    }

    @Override
    @Transactional
    public ApiResponse.BatchResult importUsers(UserImportDTO dto) {
        int successCount = 0;
        int failCount = 0;
        List<String> failMessages = new ArrayList<>();
        
        for (UserImportDTO.UserImportItem item : dto.getUsers()) {
            try {
                User user = new User();
                user.setUserCode("U" + System.currentTimeMillis());
                user.setUsername(item.getUsername());
                user.setPassword(userService.encodePassword(item.getPassword()));
                user.setRealName(item.getRealName());
                user.setPhone(item.getPhone());
                user.setEmail(item.getEmail());
                user.setUserType(item.getUserType());
                user.setIdCardType(item.getIdCardType());
                user.setIdCardNo(item.getIdCardNo());
                user.setProvince(item.getProvince());
                user.setCity(item.getCity());
                user.setDistrict(item.getDistrict());
                user.setAddress(item.getAddress());
                user.setTenantId(dto.getTenantId() != null ? dto.getTenantId().toString() : null);
                user.setUserStatus("active");
                user.setRealNameStatus("unverified");
                user.setStatus(0);
                
                userMapper.insert(user);
                successCount++;
            } catch (Exception e) {
                failCount++;
                failMessages.add(item.getUsername() + ": " + e.getMessage());
            }
        }
        
        return new ApiResponse.BatchResult(successCount, failCount, String.join("; ", failMessages));
    }

    @Override
    public byte[] exportUsers(String userStatus, String tenantId) {
        return new byte[0];
    }
}
