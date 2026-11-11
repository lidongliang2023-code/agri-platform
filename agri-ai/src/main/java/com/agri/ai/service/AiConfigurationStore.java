package com.agri.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.function.Supplier;

/** AI域配置唯一持久化源。密钥外置；文档CAS和跨文档引用校验同事务完成。 */
@Service
@org.springframework.context.annotation.DependsOn("flywayInitializer")
public class AiConfigurationStore {
    public record Document(long revision, String body) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final String keyValue;
    private final Path keyPath;
    public AiConfigurationStore(JdbcTemplate db, org.springframework.transaction.PlatformTransactionManager tm,
        ObjectMapper json, @Value("${ai.admin.encryption-key:}") String key,
        @Value("${ai.admin.provider-file:${user.home}/.agri-platform/ai-models/providers.enc}") String legacyFile) {
        this.db=db;this.tx=new TransactionTemplate(tm);this.json=json;this.keyValue=key;
        this.keyPath=Path.of(legacyFile).toAbsolutePath().resolveSibling("providers.key");
    }
    public Document read(String name) {
        var rows=db.queryForList("SELECT revision,body FROM ai_hub_configuration WHERE config_key=?",name);
        if(rows.isEmpty()) return null;
        var row=rows.get(0);return new Document(((Number)row.get("revision")).longValue(),decode(name,row.get("body").toString()));
    }
    public Document initialize(String name, Supplier<String> legacy) {
        return tx.execute(status -> {
            guard(); var existing=read(name);if(existing!=null) return existing;
            String body=legacy.get();validate(name,body);String stored=encode(name,body);
            db.update("INSERT INTO ai_hub_configuration(config_key,revision,body) VALUES(?,0,?)",name,stored);
            history(name,0,stored,"INITIAL_IMPORT");return new Document(0,body);
        });
    }
    public Document save(String name,long expected,String body) {
        return tx.execute(status -> {
            guard();validate(name,body);String stored=encode(name,body);
            if(db.update("UPDATE ai_hub_configuration SET revision=revision+1,body=?,updated_at=NOW() WHERE config_key=? AND revision=?",stored,name,expected)!=1)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"AI配置已由其他实例更新，请刷新后重试");
            history(name,expected+1,stored,"UPDATE");return new Document(expected+1,body);
        });
    }
    private void guard() { db.queryForObject("SELECT id FROM ai_hub_configuration_guard WHERE id=1 FOR UPDATE",Integer.class); }
    private void history(String name,long revision,String body,String action) {
        db.update("INSERT INTO ai_hub_configuration_history(config_key,revision,body,action) VALUES(?,?,?,?)",name,revision,body,action);
    }
    /** 同一把数据库锁保护绑定和删除。历史文档保留操作者与提示词所有版本。 */
    private void validate(String name,String body) {
        try {
            var other=read("providers".equals(name)?"scenes":"providers");
            if(other==null) return;
            JsonNode providers=json.readTree("providers".equals(name)?body:other.body());
            JsonNode scenes=json.readTree("scenes".equals(name)?body:other.body());
            Set<String> ids=new HashSet<>(List.of("tongyi","openai"));
            for(var item:providers.path("customProviders")) ids.add(item.path("id").asText());
            if(!ids.contains(providers.path("config").path("provider").asText()))
                throw new IllegalArgumentException("当前模型渠道不存在");
            for(var scene:scenes) {
                String id=scene.path("providerId").asText("");
                if(!id.isBlank() && !ids.contains(id)) throw new ResponseStatusException(HttpStatus.CONFLICT,"模型渠道仍被场景引用或已被删除，请刷新配置");
            }
        } catch(ResponseStatusException e) { throw e; }
        catch(Exception e) { throw new IllegalStateException("AI配置引用校验失败",e); }
    }
    private byte[] key(boolean create) throws Exception {
        byte[] key;
        if(!keyValue.isBlank()) key=Base64.getDecoder().decode(keyValue);
        else {
            if(!Files.exists(keyPath)) {
                if(!create) throw new IllegalStateException("AI配置解密密钥缺失，请恢复原密钥或注入相同外部密钥");
                // 兼容已有部署；多实例/容器应通过外部secret注入相同密钥。
                Files.createDirectories(keyPath.getParent());byte[] candidate=new byte[32];new SecureRandom().nextBytes(candidate);
                try { Files.write(keyPath,candidate,StandardOpenOption.CREATE_NEW); }
                catch(FileAlreadyExistsException ignored) { }
            }
            key=Files.readAllBytes(keyPath);
        }
        if(key.length!=32) throw new IllegalStateException("AI配置加密密钥必须是32字节");return key;
    }
    private String encode(String name,String body) {
        if(!"providers".equals(name)) return body;
        try {
            byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(true),"AES"),new GCMParameterSpec(128,iv));
            byte[] encrypted=cipher.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] packed=new byte[12+encrypted.length];System.arraycopy(iv,0,packed,0,12);System.arraycopy(encrypted,0,packed,12,encrypted.length);
            return Base64.getEncoder().encodeToString(packed);
        } catch(Exception e) { throw new IllegalStateException("AI渠道配置加密失败",e); }
    }
    private String decode(String name,String body) {
        if(!"providers".equals(name)) return body;
        try {
            byte[] packed=Base64.getDecoder().decode(body);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(false),"AES"),new GCMParameterSpec(128,Arrays.copyOfRange(packed,0,12)));
            return new String(cipher.doFinal(Arrays.copyOfRange(packed,12,packed.length)),java.nio.charset.StandardCharsets.UTF_8);
        } catch(Exception e) { throw new IllegalStateException("AI渠道配置解密失败，请恢复对应外部密钥，不能用默认配置覆盖",e); }
    }
}
