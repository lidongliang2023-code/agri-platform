param([string]$InputWave,[Parameter(Mandatory=$true)][string]$OutputJson,[switch]$Probe)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$engine=$null
try {
    $info=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object {$_.Culture.Name -eq 'zh-CN'} | Select-Object -First 1
    if(!$info){throw 'Chinese recognizer unavailable'}
    $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
    if($Probe){[IO.File]::WriteAllText($OutputJson,(@{status='AVAILABLE';provider='WINDOWS_LOCAL';model=$info.Id} | ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)));return}
    $grammar=New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($grammar)
    $engine.SetInputToWaveFile($InputWave)
    $segments=New-Object 'System.Collections.Generic.List[object]'
    $watch=[Diagnostics.Stopwatch]::StartNew()
    while($watch.Elapsed.TotalSeconds -lt 42){
        try {$result=$engine.Recognize([TimeSpan]::FromSeconds(8))}
        catch [System.InvalidOperationException] {if($segments.Count -gt 0){break}else{throw}}
        catch [System.Management.Automation.MethodInvocationException] {
            if($segments.Count -gt 0 -and $_.Exception.InnerException -is [System.InvalidOperationException]){break}else{throw}
        }
        if($null -eq $result){break}
        if(![string]::IsNullOrWhiteSpace($result.Text)){
            $segments.Add([pscustomobject]@{text=$result.Text;confidence=[double]$result.Confidence;offsetSeconds=$result.Audio.AudioPosition.TotalSeconds;durationSeconds=$result.Audio.Duration.TotalSeconds})
        }
    }
    if($watch.Elapsed.TotalSeconds -ge 42){throw 'Recognition timed out'}
    $text=($segments | ForEach-Object {$_.text}) -join '，'
    if([string]::IsNullOrWhiteSpace($text)){$answer=@{status='FAILED';message='未识别到清晰语音，请重录或人工补录。';provider='WINDOWS_LOCAL';segments=@()}}
    else{$answer=@{status='SUCCESS';text=$text;confidence=($segments | Measure-Object -Property confidence -Average).Average;provider='WINDOWS_LOCAL';model=$info.Id;language='zh-CN';segments=@($segments.ToArray());message='本机普通话离线识别，请对照原音逐项核对；方言能力未经验证。'}}
    [IO.File]::WriteAllText($OutputJson,($answer | ConvertTo-Json -Depth 8 -Compress),(New-Object Text.UTF8Encoding($false)))
} catch {
    [IO.File]::WriteAllText($OutputJson,(@{status='FAILED';provider='WINDOWS_LOCAL';message='本机语音识别未成功，请重试或人工补录。'} | ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
    exit 1
} finally {if($engine){$engine.Dispose()}}
