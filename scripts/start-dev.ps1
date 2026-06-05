param(
  [string]$ApiKey = $env:ARK_API_KEY,
  [int]$ApiPort = 8000,
  [int]$WebPort = 3000,
  [string]$CondaEnv = "fastapi_env"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ApiDir = Join-Path $Root "api"
$WebDir = Join-Path $Root "learning-web"
$Conda = "E:\Conda\Anaconda3\Scripts\conda.exe"

if (-not (Test-Path $Conda)) {
  throw "Conda executable not found: $Conda"
}

if (-not $ApiKey) {
  Write-Warning "ARK_API_KEY is empty. AI features will report that the API key is not configured."
}

$apiOut = Join-Path $ApiDir "uvicorn-local.out.log"
$apiErr = Join-Path $ApiDir "uvicorn-local.err.log"
$webOut = Join-Path $WebDir "next-local.out.log"
$webErr = Join-Path $WebDir "next-local.err.log"
$nextCache = Join-Path $WebDir ".next"

if (Test-Path $nextCache) {
  Remove-Item -LiteralPath $nextCache -Recurse -Force
}

$apiCmd = "/c cd /d `"$ApiDir`" && set ARK_API_KEY=$ApiKey&& set DOUBAO_TIMEOUT_S=120&& `"$Conda`" run -n $CondaEnv python -m uvicorn main:app --host 127.0.0.1 --port $ApiPort"
$webCmd = "/c cd /d `"$WebDir`" && set NEXT_PUBLIC_API_BASE=http://127.0.0.1:$ApiPort&& npm.cmd run dev -- --hostname 127.0.0.1 --port $WebPort"

Start-Process -FilePath "cmd.exe" -ArgumentList $apiCmd -WindowStyle Hidden -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr
Start-Sleep -Seconds 4
Start-Process -FilePath "cmd.exe" -ArgumentList $webCmd -WindowStyle Hidden -RedirectStandardOutput $webOut -RedirectStandardError $webErr

Write-Host "LearningWeb started:"
Write-Host "  Frontend: http://127.0.0.1:$WebPort/login"
Write-Host "  API docs: http://127.0.0.1:$ApiPort/docs"
Write-Host "  Health:   http://127.0.0.1:$ApiPort/api/health"
Write-Host ""
Write-Host "Logs:"
Write-Host "  $apiOut"
Write-Host "  $apiErr"
Write-Host "  $webOut"
Write-Host "  $webErr"
