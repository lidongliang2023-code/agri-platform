package com.example.agriplatform.masterdata.controller;

import com.example.agriplatform.common.Result;
import com.example.agriplatform.masterdata.dto.LoginDTO;
import com.example.agriplatform.masterdata.dto.UserCreateDTO;
import com.example.agriplatform.masterdata.dto.UserDTO;
import com.example.agriplatform.masterdata.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public ResponseEntity<Result<Map<String, String>>> login(@Valid @RequestBody LoginDTO loginDTO) {
        String token = userService.login(loginDTO);
        Map<String, String> result = new HashMap<>();
        result.put("token", token);
        return ResponseEntity.ok(Result.success(result));
    }

    @PostMapping
    public ResponseEntity<Result<UserDTO>> create(@Valid @RequestBody UserCreateDTO createDTO) {
        UserDTO user = userService.create(createDTO);
        return ResponseEntity.ok(Result.success(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Result<UserDTO>> getById(@PathVariable Long id) {
        UserDTO user = userService.getById(id);
        return ResponseEntity.ok(Result.success(user));
    }

    @GetMapping
    public ResponseEntity<Result<List<UserDTO>>> list() {
        List<UserDTO> users = userService.list();
        return ResponseEntity.ok(Result.success(users));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Result<UserDTO>> update(@PathVariable Long id, @RequestBody UserCreateDTO updateDTO) {
        UserDTO user = userService.update(id, updateDTO);
        return ResponseEntity.ok(Result.success(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Result<Void>> delete(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.ok(Result.success());
    }
}