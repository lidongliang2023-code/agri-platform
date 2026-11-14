package com.agri.production.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Windows已安装的中文听写引擎适配。录音不出本机；无引擎时不伪装成功。 */
@Component
public class WindowsVoiceTranscriber {
    private final ObjectMapper json;
    private final String ffmpeg;
    private final String powershell;
    private final boolean available;
    public WindowsVoiceTranscriber(ObjectMapper json,
            @Value("${agri.voice.local-enabled:true}") boolean enabled,
            @Value("${agri.voice.ffmpeg:}") String configuredFfmpeg) {
        this.json=json;
        this.ffmpeg=findFfmpeg(configuredFfmpeg);
        this.powershell=Path.of(Objects.toString(System.getenv("SystemRoot"),"C:\\Windows"),"System32","WindowsPowerShell","v1.0","powershell.exe").toString();
        this.available=enabled&&System.getProperty("os.name","").toLowerCase(Locale.ROOT).contains("windows")&&Files.isRegularFile(Path.of(powershell))&&!ffmpeg.isBlank()&&probe();
    }
    public boolean available(){return available;}
    public Map<String,Object> transcribe(byte[] audio) {
        if(!available)return Map.of("status","UNAVAILABLE","provider","WINDOWS_LOCAL","message","本机中文识别引擎不可用，请配置语音服务或人工补录。");
        Path dir=null;
        try {
            dir=Files.createTempDirectory("agri-voice-");
            Path input=dir.resolve("source.audio"),wave=dir.resolve("record.wav"),script=dir.resolve("recognize.ps1"),output=dir.resolve("result.json");
            Files.write(input,audio);copyScript(script);
            // 固定参数列表，无shell拼接；最多转241秒，用时长拒绝超长输入而非静默截断。
            if(!run(List.of(ffmpeg,"-nostdin","-v","error","-y","-i",input.toString(),"-t","241","-vn","-ac","1","-ar","16000","-c:a","pcm_s16le",wave.toString()),dir.resolve("convert.log"),12))
                return failure("录音解码失败或转换超时，请检查音频后重试。");
            if(!Files.isRegularFile(wave)||Files.size(wave)<100)return failure("音频为空或无法解码，请重新录音。");
            if(Files.size(wave)>240L*16000*2+256)return failure("音频超过四分钟，请分段上传；原始录音已保留。");
            if(!run(List.of(powershell,"-NoProfile","-NonInteractive","-File",script.toString(),"-InputWave",wave.toString(),"-OutputJson",output.toString()),dir.resolve("recognize.log"),46))
                return failure("本机识别失败或超时，请重录、分段上传或人工补录。");
            if(!Files.isRegularFile(output)||Files.size(output)>256*1024)return failure("本机识别未返回有效结果。");
            var result=json.readValue(Files.readString(output,StandardCharsets.UTF_8),new TypeReference<Map<String,Object>>(){});
            if(!"SUCCESS".equals(result.get("status")))return result;
            String text=Objects.toString(result.get("text"),"").strip();
            if(text.isBlank()||text.length()>8000)return failure("未识别到有效口述，请重新录音或人工补录。");
            result.put("text",text);result.put("verificationRequired",true);
            return result;
        } catch(InterruptedException e){Thread.currentThread().interrupt();return failure("识别已中断，原始录音仍保留。");}
        catch(Exception e){return failure("本机语音识别暂不可用，请重试或人工补录。");}
        finally{clean(dir);}
    }
    private boolean probe(){
        Path dir=null;
        try {
            dir=Files.createTempDirectory("agri-voice-probe-");Path script=dir.resolve("recognize.ps1"),output=dir.resolve("probe.json");copyScript(script);
            if(!run(List.of(powershell,"-NoProfile","-NonInteractive","-File",script.toString(),"-Probe","-OutputJson",output.toString()),dir.resolve("probe.log"),8))return false;
            return "AVAILABLE".equals(json.readTree(Files.readString(output,StandardCharsets.UTF_8)).path("status").asText());
        }catch(Exception e){return false;}finally{clean(dir);}
    }
    private void copyScript(Path target)throws java.io.IOException{try(var in=new ClassPathResource("voice/windows-transcribe.ps1").getInputStream()){Files.copy(in,target);}}
    private boolean run(List<String> command,Path log,int timeout)throws java.io.IOException,InterruptedException {
        Process process=new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {if(!process.waitFor(timeout,TimeUnit.SECONDS)){process.destroyForcibly();process.waitFor(2,TimeUnit.SECONDS);return false;}return process.exitValue()==0;}
        finally {if(process.isAlive())process.destroyForcibly();}
    }
    private String findFfmpeg(String configured){
        if(configured!=null&&!configured.isBlank())return executable(configured)?configured:"";
        List<String> candidates=new ArrayList<>();String local=System.getenv("LOCALAPPDATA");
        if(local!=null){
            Path packages=Path.of(local,"Microsoft","WinGet","Packages");
            if(Files.isDirectory(packages))try(var found=Files.find(packages,5,(path,attrs)->attrs.isRegularFile()&&path.getFileName().toString().equalsIgnoreCase("ffmpeg.exe"))){found.limit(10).forEach(path->candidates.add(path.toString()));}catch(Exception ignored){}
        }
        for(String folder:Objects.toString(System.getenv("PATH"),"").split(java.io.File.pathSeparator)){
            if(folder.isBlank())continue;try{Path candidate=Path.of(folder,"ffmpeg.exe");if(Files.isRegularFile(candidate))candidates.add(candidate.toString());}catch(InvalidPathException ignored){}
        }
        if(local!=null)candidates.add(Path.of(local,"Programs","FeiBo AI","resources","ffmpeg","bin","ffmpeg.exe").toString());
        return candidates.stream().distinct().filter(this::executable).findFirst().orElse("");
    }
    private boolean executable(String program){
        Process process=null;
        try{process=new ProcessBuilder(program,"-version").redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();return process.waitFor(3,TimeUnit.SECONDS)&&process.exitValue()==0;}
        catch(Exception e){return false;}finally{if(process!=null&&process.isAlive())process.destroyForcibly();}
    }
    private Map<String,Object> failure(String message){return Map.of("status","FAILED","provider","WINDOWS_LOCAL","message",message);}
    private void clean(Path dir){if(dir==null)return;try(var files=Files.walk(dir)){for(Path f:files.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(f);}catch(Exception ignored){}}
}
