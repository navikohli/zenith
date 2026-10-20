$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot 'apps/web/public/source/zenith-source.zip'
New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
Push-Location $projectRoot
try {
  $files = & git -c core.quotepath=false ls-files --cached --others --exclude-standard
  if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate source files.' }
  $stream = [IO.File]::Open($destination, [IO.FileMode]::Create)
  $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($relative in ($files | Sort-Object -Unique)) {
      if ($relative -like '*.zip' -or $relative -like '.git/*') { continue }
      $file = Join-Path $projectRoot $relative
      if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
      $name = Split-Path $relative -Leaf
      if ($name.StartsWith('.env') -and -not $name.EndsWith('.example')) { continue }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file, "zenith/$relative", [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally {
    $archive.Dispose()
    $stream.Dispose()
  }
  Write-Host 'Packaged current source and build material without local credentials.'
} finally {
  Pop-Location
}
