$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'output/public-speech-validation/frontend-review-20261006'
if (Test-Path -LiteralPath (Join-Path $out 'integrity.json')) { throw 'Integrity evidence already exists' }
$before = Get-Content -LiteralPath (Join-Path $out 'before.json') -Raw | ConvertFrom-Json -AsHashtable
$digest = { param($name) (Get-FileHash -LiteralPath (Join-Path $root $name) -Algorithm SHA256).Hash.ToLower() }
$inputs = @{}
foreach ($name in @('scripts/verify_frontend_speech_review.ps1',
    'output/public-speech-validation/frontend-review-20261006/before.json',
    'output/public-speech-validation/frontend-review-20261006/browser/registration.json',
    'output/public-speech-validation/frontend-review-20261006/browser/report.json',
    'output/public-speech-validation/frontend-review-20261006/browser-edge/registration.json',
    'output/public-speech-validation/frontend-review-20261006/browser-edge/report.json')) {
    $inputs[$name] = & $digest $name
}
if (Test-Path -LiteralPath (Join-Path $out 'integrity-registration.json')) { throw 'Audit registration already exists' }
@{type='FRONTEND_REVIEW_STREAMING_INTEGRITY';hashes=$inputs;createdAt=(Get-Date).ToUniversalTime().ToString('o')} |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $out 'integrity-registration.json') -Encoding utf8
$authorized = @()
$unexpected = @()
foreach ($entry in $before.hashes.GetEnumerator()) {
    $actual = & $digest $entry.Key
    if ($actual -ne $entry.Value) {
        $row = @{file=$entry.Key;beforeSHA256=$entry.Value;afterSHA256=$actual}
        if ($before.allowedProductionChanges -contains $entry.Key) { $authorized += $row } else { $unexpected += $row }
    }
}
$registeredChanges = @()
foreach ($group in @('browser','browser-edge')) {
    $reg = Get-Content -LiteralPath (Join-Path $out "$group/registration.json") -Raw | ConvertFrom-Json -AsHashtable
    foreach ($entry in $reg.hashes.GetEnumerator()) {
        if ((& $digest $entry.Key) -ne $entry.Value) { $registeredChanges += $entry.Key }
    }
}
foreach ($entry in $inputs.GetEnumerator()) {
    if ((& $digest $entry.Key) -ne $entry.Value) { $registeredChanges += $entry.Key }
}
$backupsVerified = $true
foreach ($pair in @(@('frontend/app.js','app.js.before'),@('frontend/style.css','style.css.before'))) {
    if ((Get-FileHash -LiteralPath (Join-Path $out $pair[1]) -Algorithm SHA256).Hash.ToLower() -ne $before.hashes[$pair[0]]) {
        $backupsVerified = $false
    }
}
$reserved = @()
foreach ($name in @('holdout-decoding.jsonl','holdout-assessment.json')) {
    $path = "output/public-speech-validation/beam2-assessment-20261003/$name"
    if (Test-Path -LiteralPath (Join-Path $root $path)) { $reserved += $path }
}
$result = @{checkedCurrentFiles=$before.hashes.Count;authorizedFrontendChanges=$authorized;
    unexpectedChanges=$unexpected;registeredInputChanges=$registeredChanges;backupsVerified=$backupsVerified;
    reservedHoldoutOutputsPresent=$reserved;usable=($authorized.Count -eq 2 -and !$unexpected.Count -and !$registeredChanges.Count -and $backupsVerified -and !$reserved.Count)}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $out 'integrity.json') -Encoding utf8
$result | ConvertTo-Json -Depth 6
if (!$result.usable) { exit 1 }
