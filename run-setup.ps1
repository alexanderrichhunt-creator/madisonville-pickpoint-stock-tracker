$ErrorActionPreference = "Continue"
$logPath = Join-Path $PSScriptRoot "setup-log.txt"
$projectRoot = $PSScriptRoot

Set-Location $projectRoot

"=== Setup started $(Get-Date -Format o) ===" | Tee-Object -FilePath $logPath

"--- npm install ---" | Tee-Object -FilePath $logPath -Append
npm install 2>&1 | Tee-Object -FilePath $logPath -Append
$installExit = $LASTEXITCODE

"--- npm run build (exit was $installExit before build) ---" | Tee-Object -FilePath $logPath -Append
npm run build 2>&1 | Tee-Object -FilePath $logPath -Append
$buildExit = $LASTEXITCODE

"=== Setup finished $(Get-Date -Format o) install=$installExit build=$buildExit ===" | Tee-Object -FilePath $logPath -Append
exit $buildExit
