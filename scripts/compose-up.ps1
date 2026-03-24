param(
    [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

function Get-BuildVersion {
    try {
        $sha = (git rev-parse --short=8 HEAD 2>$null).Trim()
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($sha)) {
            return $sha
        }
    } catch {
    }

    return (Get-Date).ToString("yyyyMMddHHmmss")
}

$buildVersion = Get-BuildVersion
$env:BUILD_VERSION = $buildVersion

Write-Host ">>> BUILD_VERSION: $buildVersion"

if ($PrintOnly) {
    return
}

docker compose up -d --build
