Add-Type -AssemblyName System.Speech
$demoSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$demoSpeech.SelectVoice('Microsoft Heami Desktop')
$demoSpeech.Rate = 2
$demoSpeech.Volume = 100
$chapters = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'narration.json') -Raw -Encoding utf8 | ConvertFrom-Json
for ($chapterIndex = 0; $chapterIndex -lt $chapters.Count; $chapterIndex++) {
    $wavPath = Join-Path $PSScriptRoot ('voice-{0}.wav' -f $chapterIndex)
    $demoSpeech.SetOutputToWaveFile($wavPath)
    $demoSpeech.Speak($chapters[$chapterIndex].speech)
    $demoSpeech.SetOutputToNull()
}
$demoSpeech.Dispose()
Write-Output 'Korean narration generated with the installed Heami voice.'
