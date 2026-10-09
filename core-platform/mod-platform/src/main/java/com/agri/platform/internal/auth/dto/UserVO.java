package com.agri.platform.internal.auth.dto;

import java.util.List;

public record UserVO(Long id, String username, String nickname, List<String> roles) {
}
