package com.agri.platform.internal.identity;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * 身份证号的校验 / 掩码 / 加盐哈希。
 *
 * <p>单独抽出来是因为这三件事必须**只用一套实现**：校验口径不一致会出现
 * "提交时收下了、比对时对不上"；掩码与哈希各写一份则很容易在某处漏掉而写入明文。</p>
 *
 * <p><b>明文只在本类的入参里出现，不落库、不进日志。</b></p>
 */
public final class IdNumberUtil {

    /** 加权因子（GB 11643-1999）。 */
    private static final int[] WEIGHTS = {7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2};

    /** 校验码字符表。 */
    private static final char[] CHECK_CODES = {'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'};

    private static final SecureRandom RANDOM = new SecureRandom();

    private IdNumberUtil() {
    }

    /**
     * 校验 18 位身份证号（含校验位）。
     *
     * @param idNo 号码
     * @return 规范化后的号码（末位统一大写）
     */
    public static String validate(String idNo) {
        String value = idNo == null ? "" : idNo.trim().toUpperCase();
        if (value.length() != 18) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "身份证号必须是 18 位");
        }
        for (int i = 0; i < 17; i++) {
            if (!Character.isDigit(value.charAt(i))) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "身份证号前 17 位必须是数字");
            }
        }
        char last = value.charAt(17);
        if (!Character.isDigit(last) && last != 'X') {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "身份证号末位只能是数字或 X");
        }
        int sum = 0;
        for (int i = 0; i < 17; i++) {
            sum += (value.charAt(i) - '0') * WEIGHTS[i];
        }
        if (CHECK_CODES[sum % 11] != last) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "身份证号校验位不正确，请核对后重新输入");
        }
        return value;
    }

    /**
     * 生成掩码：前 3 位 + 11 个 * + 后 4 位（例如 {@code 330***********1234}）。
     *
     * <p>只留省级与尾号 —— 够人工核对，又不足以反推出完整号码。</p>
     */
    public static String mask(String idNo) {
        if (idNo == null || idNo.length() < 8) {
            return "***";
        }
        return idNo.substring(0, 3) + "***********" + idNo.substring(idNo.length() - 4);
    }

    /** 生成一条记录用的随机盐（16 字节）。 */
    public static String newSalt() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * 加盐 SHA-256。
     *
     * <p>盐是**每条记录独立**的：既避免彩虹表，也仍然支持"同一个人重复提交时用同一个盐
     * 比对号码有没有换" —— 比对在同一条记录的盐下进行，不需要全局盐。</p>
     */
    public static String hash(String idNo, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update((salt == null ? "" : salt).getBytes(StandardCharsets.UTF_8));
            digest.update(idNo.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            // SHA-256 是 JDK 必备算法，走到这里说明运行环境异常，不能静默降级成明文
            throw new BusinessException(ErrorCode.BIZ_ERROR, "身份证号摘要计算失败");
        }
    }
}
