package com.agri.iot.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.security.*;
import java.util.*;

/** 固件文件只存储不执行、不解压；摘要与长度来自实际字节流。 */
@Service
public class FirmwareStorageService {
    private final Path root;
    private final String base;
    private final long max;
    public FirmwareStorageService(@Value("${iot.firmware.storage-dir:data/firmware}") String directory,
            @Value("${iot.firmware.public-base-url:}") String baseUrl,
            @Value("${iot.firmware.max-bytes:268435456}") long maxBytes) {
        root=Path.of(directory).toAbsolutePath().normalize();
        base=baseUrl.replaceAll("/+$", ""); max=maxBytes;
        if(max<=0 || max>2147483648L)throw new IllegalArgumentException("固件上传大小配置无效");
    }
    private void configured() {
        URI uri;
        try{uri=URI.create(base);}catch(Exception e){throw new IllegalArgumentException("请配置固件服务HTTPS对外地址");}
        if(!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null)
            throw new IllegalArgumentException("请配置iot.firmware.public-base-url为网关可达的HTTPS地址，路径指向/api/v1/iot/gateway-channel/firmware");
    }
    private MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(Exception e){throw new IllegalStateException(e);}}
    public synchronized Map<String,Object> upload(MultipartFile file,String expected) {
        configured();
        String name=Objects.toString(file.getOriginalFilename(), "");
        if(name.length()>200 || name.contains("/") || name.contains("\\") || name.chars().anyMatch(c->c<32) || !name.toLowerCase(Locale.ROOT).matches(".+\\.(bin|img|zip|fw|hex|tar|gz)"))
            throw new IllegalArgumentException("请选择bin、img、zip、fw、hex、tar或gz固件文件，文件名不得包含路径");
        if(file.isEmpty() || file.getSize()>max)throw new IllegalArgumentException("固件文件为空或超过上传上限");
        String wanted=Objects.toString(expected, "").trim().toLowerCase(Locale.ROOT);
        if(!wanted.isEmpty()&&!wanted.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("预期摘要必须为64位SHA-256");
        Path temp=null;
        try {
            Files.createDirectories(root);temp=Files.createTempFile(root,"upload-",".part");
            MessageDigest md=digest();long size=0;
            try(InputStream in=file.getInputStream();OutputStream out=Files.newOutputStream(temp)){
                byte[] buffer=new byte[65536];int n;
                while((n=in.read(buffer))!=-1){size+=n;if(size>max)throw new IllegalArgumentException("实际文件流超过上传上限");md.update(buffer,0,n);out.write(buffer,0,n);}
            }
            if(size==0 || size!=file.getSize())throw new IllegalArgumentException("实际文件长度与上传声明不一致");
            String hash=HexFormat.of().formatHex(md.digest());
            if(!wanted.isEmpty()&&!MessageDigest.isEqual(hash.getBytes(java.nio.charset.StandardCharsets.US_ASCII),wanted.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))throw new IllegalArgumentException("文件SHA-256与预期摘要不一致，上传已拒绝");
            Path target=path(hash);
            if(Files.exists(target))verify(base+"/"+hash,hash,size);
            else try{Files.move(temp,target,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException e){Files.move(temp,target);}
            return Map.of("packageUrl",base+"/"+hash,"sha256Text",hash,"fileSizeBytes",size,"originalName",name,"verification","服务端已核验实际文件SHA-256与大小");
        }catch(IOException e){throw new IllegalStateException("固件文件存储失败",e);}
        finally{if(temp!=null)try{Files.deleteIfExists(temp);}catch(IOException ignored){}}
    }
    private Path path(String hash){
        if(hash==null||!hash.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("无效固件文件标识");
        Path p=root.resolve(hash+".pkg");
        if(Files.isSymbolicLink(p))throw new IllegalArgumentException("固件文件路径无效");return p;
    }
    public boolean managed(String url){return !base.isBlank() && url.startsWith(base+"/");}
    public Path verify(String url,String hash,long size){
        configured();
        if(!url.equals(base+"/"+hash))throw new IllegalArgumentException("托管文件地址与摘要不一致");
        Path p=path(hash);
        try{
            if(!Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS)||Files.size(p)!=size)throw new IllegalArgumentException("固件文件缺失或大小不一致");
            MessageDigest md=digest();try(InputStream in=Files.newInputStream(p)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)md.update(buf,0,n);}
            if(!hash.equals(HexFormat.of().formatHex(md.digest())))throw new IllegalArgumentException("固件文件摘要不一致，已阻止发布或下载");return p;
        }catch(IOException e){throw new IllegalStateException("固件文件读取失败",e);}
    }
}
