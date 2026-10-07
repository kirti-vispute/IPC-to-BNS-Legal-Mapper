$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$original = Join-Path $root 'output/public-speech-validation/backend-review-20261006'
$out = Join-Path $root 'output/public-speech-validation/backend-review-audit-retry-20261006'
if (Test-Path -LiteralPath $out) { throw 'Audit output already exists; preserve it' }
$before = Get-Content -LiteralPath (Join-Path $original 'before.json') -Raw | ConvertFrom-Json -AsHashtable
$smoke = Get-Content -LiteralPath (Join-Path $original 'registration.json') -Raw | ConvertFrom-Json -AsHashtable
$digest = { param($name) (Get-FileHash -LiteralPath (Join-Path $root $name) -Algorithm SHA256).Hash.ToLower() }
$inputs = @{}
foreach ($name in @('scripts/verify_backend_speech_review.ps1',
    'output/public-speech-validation/backend-review-20261006/before.json',
    'output/public-speech-validation/backend-review-20261006/registration.json',
    'output/public-speech-validation/backend-review-20261006/report.json',
    'output/public-speech-validation/backend-review-20261006/audit-failure.json')) {
    $inputs[$name] = & $digest $name
}
New-Item -ItemType Directory -Path $out | Out-Null
@{ type='STREAMING_BACKEND_REVIEW_INTEGRITY_RETRY'; hashes=$inputs; createdAt=(Get-Date).ToUniversalTime().ToString('o') } |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $out 'registration.json') -Encoding utf8
$changes = @()
$unexpected = @()
foreach ($entry in $before.historicalCommitments.GetEnumerator()) {
    $actual = & $digest $entry.Key
    if ($actual -ne $entry.Value.ToLower()) {
        $name = $entry.Key.Replace('\','/')
        $row = @{file=$name; beforeSHA256=$entry.Value.ToLower(); afterSHA256=$actual}
        if ($before.allowedProductionChanges -contains $name) { $changes += $row } else { $unexpected += $row }
    }
}
$protectedChanges = @()
foreach ($map in @($before.protectedLegal, $before.registrationFiles, $smoke.hashes, $inputs)) {
    foreach ($entry in $map.GetEnumerator()) {
        if ((& $digest $entry.Key) -ne $entry.Value.ToLower()) { $protectedChanges += $entry.Key }
    }
}
foreach ($pair in @(@('backend/speech/transcribe.py','transcribe.py.before'),
                   @('backend/core/transcriber.js','transcriber.js.before'))) {
    $expected = $before.historicalCommitments[$pair[0]]
    if ((Get-FileHash -LiteralPath (Join-Path $original $pair[1]) -Algorithm SHA256).Hash.ToLower() -ne $expected.ToLower()) {
        $protectedChanges += $pair[1]
    }
}
$reserved = @()
foreach ($name in @('holdout-decoding.jsonl','holdout-assessment.json')) {
    $path = "output/public-speech-validation/beam2-assessment-20261003/$name"
    if (Test-Path -LiteralPath (Join-Path $root $path)) { $reserved += $path }
}
$result = @{historicalIdentities=$before.historicalCommitments.Count;
    protectedLegalAndPipelineFiles=$before.protectedLegal.Count; frozenRegistrations=$before.registrationFiles.Count;
    registeredSmokeInputs=$smoke.hashes.Count; authorizedProductionChanges=$changes;
    unexpectedHistoricalChanges=$unexpected; protectedChanges=$protectedChanges;
    reservedHoldoutOutputsPresent=$reserved; backupsVerified=($protectedChanges.Count -eq 0);
    usable=($changes.Count -eq 2 -and !$unexpected.Count -and !$protectedChanges.Count -and !$reserved.Count)}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out 'integrity.json') -Encoding utf8
$result | ConvertTo-Json -Depth 8
if (!$result.usable) { exit 1 }
