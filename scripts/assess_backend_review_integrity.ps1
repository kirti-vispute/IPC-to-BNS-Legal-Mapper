$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'output/public-speech-validation/backend-review-normalized-audit-20261006'
if (Test-Path -LiteralPath $out) { throw 'Output already exists; preserve evidence' }
$digest = { param($name) (Get-FileHash -LiteralPath (Join-Path $root $name) -Algorithm SHA256).Hash.ToLower() }
$inputs = @{}
foreach ($name in @('scripts/assess_backend_review_integrity.ps1',
    'output/public-speech-validation/backend-review-20261006/before.json',
    'output/public-speech-validation/backend-review-20261006/registration.json',
    'output/public-speech-validation/backend-review-audit-retry-20261006/registration.json',
    'output/public-speech-validation/backend-review-audit-retry-20261006/integrity.json')) {
    $inputs[$name] = & $digest $name
}
$read = { param($name) Get-Content -LiteralPath (Join-Path $root $name) -Raw | ConvertFrom-Json -AsHashtable }
$before = & $read 'output/public-speech-validation/backend-review-20261006/before.json'
$smoke = & $read 'output/public-speech-validation/backend-review-20261006/registration.json'
$retry = & $read 'output/public-speech-validation/backend-review-audit-retry-20261006/registration.json'
$canonical = @{}
$aliases = @()
foreach ($entry in $before.historicalCommitments.GetEnumerator()) {
    $name = $entry.Key.Replace('\','/')
    $hash = $entry.Value.ToLower()
    if ($canonical.ContainsKey($name)) {
        if ($canonical[$name] -ne $hash) { throw "Conflicting commitment: $name" }
        $aliases += $entry.Key
    }
    $canonical[$name] = $hash
}
New-Item -ItemType Directory -Path $out | Out-Null
@{type='CANONICAL_PATH_STREAMING_INTEGRITY';hashes=$inputs;createdAt=(Get-Date).ToUniversalTime().ToString('o')} |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $out 'registration.json') -Encoding utf8
$changes = @()
$unexpected = @()
foreach ($entry in $canonical.GetEnumerator()) {
    $actual = & $digest $entry.Key
    if ($actual -ne $entry.Value) {
        $row = @{file=$entry.Key;beforeSHA256=$entry.Value;afterSHA256=$actual}
        if ($before.allowedProductionChanges -contains $entry.Key) { $changes += $row } else { $unexpected += $row }
    }
}
$protectedChanges = @()
foreach ($map in @($before.protectedLegal,$before.registrationFiles,$smoke.hashes,$retry.hashes,$inputs)) {
    foreach ($entry in $map.GetEnumerator()) {
        if ((& $digest $entry.Key) -ne $entry.Value.ToLower()) { $protectedChanges += $entry.Key }
    }
}
foreach ($pair in @(@('backend/speech/transcribe.py','transcribe.py.before'),@('backend/core/transcriber.js','transcriber.js.before'))) {
    $backup = 'output/public-speech-validation/backend-review-20261006/' + $pair[1]
    if ((& $digest $backup) -ne $canonical[$pair[0]]) { $protectedChanges += $backup }
}
$reserved = @()
foreach ($name in @('holdout-decoding.jsonl','holdout-assessment.json')) {
    $path = "output/public-speech-validation/beam2-assessment-20261003/$name"
    if (Test-Path -LiteralPath (Join-Path $root $path)) { $reserved += $path }
}
$result = @{historicalCommitmentKeys=$before.historicalCommitments.Count;canonicalHistoricalFiles=$canonical.Count;
    duplicateIdenticalPathAliases=$aliases;authorizedProductionChanges=$changes;unexpectedHistoricalChanges=$unexpected;
    protectedLegalAndPipelineFiles=$before.protectedLegal.Count;frozenRegistrations=$before.registrationFiles.Count;
    registeredSmokeInputs=$smoke.hashes.Count;protectedChanges=$protectedChanges;reservedHoldoutOutputsPresent=$reserved;
    backupsVerified=(!$protectedChanges.Count);usable=($changes.Count -eq 2 -and !$unexpected.Count -and !$protectedChanges.Count -and !$reserved.Count)}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out 'integrity.json') -Encoding utf8
$result | ConvertTo-Json -Depth 8
if (!$result.usable) { exit 1 }
