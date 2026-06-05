param(
  [int[]]$Ports = @(3000, 8000)
)

$ErrorActionPreference = "Stop"

foreach ($Port in $Ports) {
  $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    $processId = [int]$parts[-1]
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped process $processId on port $Port"
    }
  }
}
