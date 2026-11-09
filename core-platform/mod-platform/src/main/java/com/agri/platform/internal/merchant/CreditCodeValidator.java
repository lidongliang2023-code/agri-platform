package com.agri.platform.internal.merchant;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;

/** GB 32100 统一社会信用代码字符及校验位校验。 */
public final class CreditCodeValidator {
    private CreditCodeValidator() {}
    public static String validate(String raw) {
        String code = raw == null ? "" : raw.trim().toUpperCase(java.util.Locale.ROOT);
        String chars = "0123456789ABCDEFGHJKLMNPQRTUWXY";
        int[] weights = {1,3,9,27,19,26,16,17,20,29,25,13,8,24,10,30,28};
        if (code.length() != 18) throw invalid();
        int sum = 0;
        for (int i = 0; i < 18; i++) {
            int index = chars.indexOf(code.charAt(i));
            if (index < 0) throw invalid();
            if (i < 17) sum += index * weights[i];
        }
        if (chars.charAt((31 - sum % 31) % 31) != code.charAt(17)) throw invalid();
        return code;
    }
    private static BusinessException invalid() {
        return new BusinessException(ErrorCode.BAD_REQUEST, "统一社会信用代码须为18位有效代码，请核对营业执照及校验位");
    }
}
