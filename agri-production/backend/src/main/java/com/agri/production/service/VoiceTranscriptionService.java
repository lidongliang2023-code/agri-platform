package com.agri.production.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/** 标准 multipart audio/transcriptions 协议适配；仅真实响应算成功。密钥只读部署环境。 */
@Service
public class VoiceTranscriptionService {
    private final ObjectMapper json;
    private final String endpoint,key,model;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private WindowsVoiceTranscriber local;
    public Map<String,Object> capability(){return Map.of("available",configured(),"mode",!endpoint.isBlank()&&!model.isBlank()?"CLOUD":local!=null&&local.available()?"WINDOWS_LOCAL":"UNAVAILABLE","description",!endpoint.isBlank()&&!model.isBlank()?"已配置真实语音转写服务，识别后仍须核对":"本机中文离线识别；普通话需人工核对，方言效果未经验证");}
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    public VoiceTranscriptionService(ObjectMapper json,
        @Value("${agri.voice.asr-url:}") String endpoint,
        @Value("${agri.voice.asr-key:}") String key,
        @Value("${agri.voice.asr-model:}") String model) {this.json=json;this.endpoint=endpoint;this.key=key;this.model=model;}
    public boolean configured(){return !endpoint.isBlank()&&!model.isBlank()||local!=null&&local.available();}
    public Map<String,Object> transcribe(byte[] audio,String type) {
        if(endpoint.isBlank()||model.isBlank()) {
            if(local!=null&&local.available())return local.transcribe(audio);
            return Map.of("status","UNAVAILABLE","message","语音转写暂不可用，请人工补录；原始录音已保留。");
        }
        try {
            URI uri=URI.create(endpoint);
            if(!"https".equals(uri.getScheme())&&!Set.of("localhost","127.0.0.1").contains(uri.getHost())) throw new IllegalArgumentException();
            String boundary="voice"+UUID.randomUUID().toString().replace("-","");
            var body=new ByteArrayOutputStream();
            body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n"+model+"\r\n").getBytes(StandardCharsets.UTF_8));
            String ext=type.contains("wav")?"wav":type.contains("mpeg")?"mp3":type.contains("ogg")?"ogg":type.contains("mp4")?"m4a":"webm";
            body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"record."+ext+"\"\r\nContent-Type: "+type+"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(audio);body.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
            var builder=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(40)).header("Content-Type","multipart/form-data; boundary="+boundary);
            if(!key.isBlank()) builder.header("Authorization","Bearer "+key);
            var response=http.send(builder.POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(),HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200) return Map.of("status","FAILED","message","语音供应商返回 HTTP "+response.statusCode()+"，请重试或人工补录。");
            String text=json.readTree(response.body()).path("text").asText("").strip();
            if(text.isBlank()||text.length()>8000) throw new IllegalArgumentException();
            return Map.of("status","SUCCESS","text",text,"model",model,"traceId",response.headers().firstValue("x-request-id").orElse(""));
        } catch(InterruptedException e) {Thread.currentThread().interrupt();return Map.of("status","FAILED","message","转写中断，请人工补录或重试。");}
        catch(Exception e) {return Map.of("status","FAILED","message","真实语音转写未成功，请人工补录或重试。");}
    }
    public static String validatedType(byte[] data) {
        if(data==null||data.length<12||data.length>12*1024*1024) throw new IllegalArgumentException("录音需为 12MB 以内的有效音频");
        if(data[0]=='R'&&data[1]=='I'&&data[2]=='F'&&data[3]=='F'&&data[8]=='W'&&data[9]=='A'&&data[10]=='V'&&data[11]=='E')return "audio/wav";
        if(data[0]=='O'&&data[1]=='g'&&data[2]=='g'&&data[3]=='S')return "audio/ogg";
        if((data[0]&255)==0x1a&&(data[1]&255)==0x45&&(data[2]&255)==0xdf&&(data[3]&255)==0xa3)return "audio/webm";
        if(data[4]=='f'&&data[5]=='t'&&data[6]=='y'&&data[7]=='p')return "audio/mp4";
        if(data[0]=='I'&&data[1]=='D'&&data[2]=='3'||(data[0]&255)==255&&((data[1]&224)==224))return "audio/mpeg";
        throw new IllegalArgumentException("仅支持 WAV、MP3、M4A、WebM、Ogg 音频，文件内容与格式必须一致");
    }
}
