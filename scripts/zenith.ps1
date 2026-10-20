[CmdletBinding()]
param(
  [ValidateSet('up', 'rebuild', 'down', 'status', 'logs', 'config')]
  [string]$Action = 'up',
  [ValidateRange(1024, 65535)]
  [int]$Port = 3100
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot '.env.zenith.local'

function New-LocalSecret {
  $bytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

if (-not (Test-Path -LiteralPath $envFile)) {
  @(
    "ZENITH_PORT=$Port"
    "ZENITH_SECRET_KEY=$(New-LocalSecret)"
    "ZENITH_DB_PASSWORD=$(New-LocalSecret)"
    "ZENITH_STORAGE_PASSWORD=$(New-LocalSecret)"
  ) | Set-Content -LiteralPath $envFile -Encoding utf8
  Write-Host 'Created local Zenith credentials in .env.zenith.local (gitignored).'
}

if ($PSBoundParameters.ContainsKey('Port')) {
  $localConfig = Get-Content -LiteralPath $envFile
  $localConfig = $localConfig -replace '^ZENITH_PORT=.*$', "ZENITH_PORT=$Port"
  $localConfig | Set-Content -LiteralPath $envFile -Encoding utf8
}

Push-Location $projectRoot
try {
  $composeArgs = @('compose', '--env-file', $envFile, '-f', 'compose.zenith.yml')
  switch ($Action) {
    'up' {
      & docker info --format '{{.ServerVersion}}'
      if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before running Zenith.' }
      & docker image inspect zenith:local --format '{{.Id}}' 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) {
        & (Join-Path $PSScriptRoot 'package-source.ps1')
        & docker @composeArgs up --build -d --wait --wait-timeout 240
      } else {
        & docker @composeArgs up -d --wait --wait-timeout 240
      }
    }
    'rebuild' {
      & (Join-Path $PSScriptRoot 'package-source.ps1')
      & docker @composeArgs up --build -d --wait --wait-timeout 240
    }
    'down' { & docker @composeArgs down }
    'status' { & docker @composeArgs ps }
    'logs' { & docker @composeArgs logs --tail 100 app }
    'config' { & docker @composeArgs config --quiet }
  }
  if ($LASTEXITCODE -ne 0) { throw "Zenith command failed: $Action" }
} finally {
  Pop-Location
}
