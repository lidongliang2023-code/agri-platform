package com.agri.platform.internal.sso;

import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 手机验证码登录 / 手机号验证码注册（2026-10-16）。

 *
 * <p><b>短信通道当前没有接入真实服务商</b>（需要 AccessKey / Secret / 签名 / 模板），所以按模式分流：</p>

 *
 * <ul>
 *   <li>{@code agri.auth.sms.mode=dev}（**只在 application-dev.yml 打开**）：验证码**写后端日志**，
 *       <b>不回响应体、不以明文落库</b> —— 联调时从日志取；这样页面流程与生产完全一致，
 *       不会有"验证码被前端拿到"的口子。</li>
 *   <li>{@code mode=none}（默认，生产形态）：发送直接拒绝并说明原因，不放"看起来发了、其实没发"的假象。</li>
 * </ul>

 *
 * <p>验证码存 Redis：TTL 5 分钟、同一手机号 60 秒内不重发、最多校验 5 次（错满即作废）。</p>

 *
 * <p><b>注册只建账号与平台角色，不建经营主体绑定</b>：绑定在哪家主体、什么身份，是产品口径
 * （见类尾注释）。未绑定的账号登录后由各业务域如实提示"还没有绑定经营主体"。</p>
 */
@Slf4j
@Service
public class SmsAuthService {

    private static final String CODE_KEY = "agri:sms:code:";
    private static final String ATTEMPT_KEY = "agri:sms:attempt:";
    private static final String COOLDOWN_KEY = "agri:sms:cooldown:";
    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    private final StringRedisTemplate redis;
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /** 短信通道模式：none（默认，未配置服务商）/ dev（验证码写日志，仅联调用） */
    private final String mode;

    public SmsAuthService(StringRedisTemplate redis, UserMapper userMapper, UserRoleMapper userRoleMapper,
                          RoleMapper roleMapper,
                          @Value("${agri.auth.sms.mode:none}") String mode) {
        this.redis = redis;
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
        this.mode = mode == null ? "none" : mode.trim().toLowerCase();
        if ("dev".equals(this.mode)) {
            log.warn("短信通道运行在 [dev] 模式：验证码只写日志，不会真正发送短信。生产环境请把 "
                    + "agri.auth.sms.mode 改成真实服务商（并补齐 AccessKey/签名/模板）。");
        }
    }

    /** 是否处于 dev 通道（页面据此提示"验证码见后端日志"） */
    public boolean devMode() {
        return "dev".equals(mode);
    }

    /**
     * 发送验证码。

     *
     * @param phone 手机号（11 位）
     * @param scene 场景：login 登录 / register 注册（不同场景的码不通用）
     */
    public void send(String phone, String scene) {
        String normalized = normalizePhone(phone);
        assertScene(scene);
        if (!devMode()) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "短信通道未配置（agri.auth.sms.mode=" + mode + "）：请提供短信服务商的 AccessKey、签名与模板后再启用");
        }
        if (Boolean.TRUE.equals(redis.hasKey(COOLDOWN_KEY + normalized))) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码已发送，请 60 秒后再试");
        }
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
        redis.opsForValue().set(CODE_KEY + scene + ":" + normalized, code, CODE_TTL);
        redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
        redis.opsForValue().set(COOLDOWN_KEY + normalized, "1", COOLDOWN);
        // 只进日志：不回响应体、不落库明文
        log.warn("[DEV 短信通道] {} 的验证码（场景 {}）＝ {}（5 分钟内有效）", mask(normalized), scene, code);
    }

    /**
     * 校验验证码：成功即作废；错误累计到上限整体作废。

     *
     * @param phone 手机号
     * @param scene 场景（与发送时一致）
     * @param code 用户输入的验证码
     */
    public void verify(String phone, String scene, String code) {
        String normalized = normalizePhone(phone);
        assertScene(scene);
        if (code == null || !code.trim().matches("\\d{6}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码应为 6 位数字");
        }
        String key = CODE_KEY + scene + ":" + normalized;
        String expected = redis.opsForValue().get(key);
        if (expected == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码已过期或未发送，请重新获取");
        }
        Long attempts = redis.opsForValue().increment(ATTEMPT_KEY + scene + ":" + normalized);
        if (attempts != null && attempts > MAX_ATTEMPTS) {
            redis.delete(key);
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码错误次数过多，请重新获取");
        }
        if (!expected.equals(code.trim())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码不正确");
        }
        // 一次性：验过即删，防重放
        redis.delete(key);
        redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
    }

    /**
     * 按手机号取账号（验证码登录用）。

     *
     * @param phone 手机号
     * @returns 账号实体
     * @throws BusinessException 没有该手机号的账号（消息里说清"去注册"）
     */
    public UserEntity requireUserByPhone(String phone) {
        String normalized = normalizePhone(phone);
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, normalized));
        if (user == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该手机号还没有注册账号，请先注册");
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.USER_DISABLED);
        }
        return user;
    }

    /**
     * 手机号验证码注册：手机号即账号，授予平台 {@code FARMER} 角色。

     *
     * <p>账号初始**没有密码**（随机 BCrypt 串占位）：注册走的是验证码，密码登录要等用户自己设密码，
     * 不能给个能猜到的默认口令。</p>

     *
     * <p><b>不建经营主体绑定</b>：绑定到哪家主体、以什么身份，是产品口径 —— 自注册常见两种做法：
     * ①"注册即开通自己的经营主体"（为每个注册者建一家主体）；②"先注册、等运营开通"。
     * 本实现取②，未绑定账号登录后由业务域如实提示缺绑定（403 且消息可读），不擅自把新用户塞进任何既有主体。</p>
     *
     * @param phone 手机号（同时作为登录账号名）
     * @param nickname 昵称（可空，默认"用户+手机号后四位"）
     * @param marketId 进入的市场（缺省 1）
     * @returns 新建账号实体
     */
    public UserEntity registerByPhone(String phone, String nickname, Long marketId) {
        String normalized = normalizePhone(phone);
        Long market = marketId == null ? 1L : marketId;
        UserEntity exists = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, normalized));
        if (exists != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "该手机号已注册，请直接登录");
        }
        UserEntity user = new UserEntity();
        user.setUsername(normalized);
        // 没有密码：随机串占位，密码登录（username/phone + password）对它是登不进去的
        user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
        user.setPhone(normalized);
        user.setNickname(nickname == null || nickname.isBlank()
                ? "用户" + normalized.substring(normalized.length() - 4)
                : nickname.trim());
        user.setStatus(1);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);

        RoleEntity farmer = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, "FARMER"));
        if (farmer == null) {
            log.warn("平台没有 FARMER 角色，注册用户 {} 未授任何角色", user.getId());
        } else {
            UserRoleEntity binding = new UserRoleEntity();
            binding.setUserId(user.getId());
            binding.setRoleId(farmer.getId());
            binding.setMarketId(market);
            userRoleMapper.insert(binding);
        }
        log.info("手机号注册成功：user={} phone={}（未建经营主体绑定，等运营开通）", user.getId(), mask(normalized));
        return user;
    }

    private static void assertScene(String scene) {
        if (!"login".equals(scene) && !"register".equals(scene)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "场景只能是 login 或 register");
        }
    }

    private static String normalizePhone(String phone) {
        String value = phone == null ? "" : phone.trim();
        if (!value.matches("1[3-9]\\d{9}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "手机号格式不正确");
        }
        return value;
    }

    private static String mask(String phone) {
        return phone.length() == 11 ? phone.substring(0, 3) + "****" + phone.substring(7) : phone;
    }
}
