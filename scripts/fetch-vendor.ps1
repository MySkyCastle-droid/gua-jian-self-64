$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $projectRoot 'dist\vendor\surveyjs\3.2.2'
$dataDir = Join-Path $projectRoot 'dist\data'
$licenseDir = Join-Path $projectRoot 'dist\licenses'
New-Item -ItemType Directory -Force -Path $vendorDir,$dataDir,$licenseDir | Out-Null
$downloads = @(
    @{ Url='https://unpkg.com/survey-core@3.2.2/survey-core.min.css'; Path=(Join-Path $vendorDir 'survey-core.min.css') },
    @{ Url='https://unpkg.com/survey-core@3.2.2/survey.core.min.js'; Path=(Join-Path $vendorDir 'survey.core.min.js') },
    @{ Url='https://unpkg.com/survey-core@3.2.2/i18n/traditional-chinese.min.js'; Path=(Join-Path $vendorDir 'traditional-chinese.min.js') },
    @{ Url='https://unpkg.com/survey-js-ui@3.2.2/survey-js-ui.min.js'; Path=(Join-Path $vendorDir 'survey-js-ui.min.js') },
    @{ Url='https://raw.githubusercontent.com/surveyjs/survey-library/v3.2.2/LICENSE'; Path=(Join-Path $licenseDir 'SurveyJS-MIT.txt') }
)
$commit = Invoke-RestMethod -Uri 'https://api.github.com/repos/strobus/i-ching/commits/main' -Headers @{ 'User-Agent'='GuajianSelf-VendorFetch' }
$revision = $commit.sha
$downloads += @{ Url="https://raw.githubusercontent.com/strobus/i-ching/$revision/lib/data.json"; Path=(Join-Path $dataDir 'iching-source.json') }
$downloads += @{ Url="https://raw.githubusercontent.com/strobus/i-ching/$revision/LICENSE"; Path=(Join-Path $licenseDir 'i-ching-MIT.txt') }
$manifest = @()
foreach ($item in $downloads) {
    Invoke-WebRequest -UseBasicParsing -Uri $item.Url -OutFile $item.Path
    $manifest += [ordered]@{ url=$item.Url; file=$item.Path.Substring($projectRoot.Length+1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $item.Path -Algorithm SHA256).Hash.ToLower(); bytes=(Get-Item -LiteralPath $item.Path).Length }
}
$source = Get-Content -LiteralPath (Join-Path $dataDir 'iching-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$payload = $source | ConvertTo-Json -Depth 20 -Compress
$script = "window.GuaData = window.GuaData || {}; window.GuaData.iching = $payload;"
[System.IO.File]::WriteAllText((Join-Path $dataDir 'hexagrams.js'),$script,[System.Text.UTF8Encoding]::new($false))
$record = [ordered]@{ fetched='2026-10-23'; surveyjs_version='3.2.2'; iching_commit=$revision; files=$manifest }
[System.IO.File]::WriteAllText((Join-Path $projectRoot 'vendor-manifest.json'),($record|ConvertTo-Json -Depth 10),[System.Text.UTF8Encoding]::new($false))
$record | ConvertTo-Json -Depth 10
