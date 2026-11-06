param(
    [string]$ExtensionId,
    [string]$ClientId,
    [string]$AssetKey
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.nfsu2.discord_presence'
$companionDir = $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source

if (-not $ExtensionId) {
    $ExtensionId = Read-Host 'Extension ID (same ID in Brave and Chrome)'
}
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    throw 'Invalid extension ID. Copy the 32-letter ID (a-p) shown on the extensions page in Brave or Chrome; the ID is the same in both browsers.'
}

if (-not $ClientId) {
    $ClientId = Read-Host 'Discord application Client ID'
}
if ($ClientId -notmatch '^\d{15,25}$') {
    throw 'Client ID must be the numeric Application ID from Discord Developer Portal.'
}
if (-not $AssetKey) {
    $AssetKey = Read-Host 'Uploaded Rich Presence cover asset key (for example underground2_cover)'
}
if ($AssetKey -notmatch '^[a-zA-Z0-9_-]{1,128}$') {
    throw 'Asset key may contain letters, numbers, underscores, and hyphens.'
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$config = @{ clientId = $ClientId; coverAssetKey = $AssetKey } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $companionDir 'config.json'), $config, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $companionDir 'node-path.txt'), $node, $utf8NoBom)

$launcherPath = Join-Path $companionDir 'nfsu2-native-host.exe'
if (-not (Test-Path $launcherPath)) {
    throw "Native host launcher is missing: $launcherPath. Restore the project files and run setup again."
}
$manifest = @{
    name = $hostName
    description = 'Discord Rich Presence companion for nfsu2.xyz'
    path = $launcherPath
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
$manifestPath = Join-Path $companionDir 'native-host-manifest.json'
[System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

$registryPaths = @(
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$hostName",
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
)
foreach ($registryPath in $registryPaths) {
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $manifestPath
}

Write-Host 'Setup complete. Restart Brave or Chrome and Discord, then visit https://nfsu2.xyz/.'
Write-Host "Native host manifest: $manifestPath"
Write-Host 'Native messaging registered for Brave and Chromium-compatible browser lookup.'
