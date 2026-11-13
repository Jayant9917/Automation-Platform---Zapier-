param(
    [ValidateSet("frontend", "primary-backend", "hooks", "processor", "worker")]
    [string[]]$Service = @("frontend", "primary-backend", "hooks", "processor", "worker"),
    [switch]$Build
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
foreach ($module in $Service) {
    $imageName = "actionhub-$module-dev"
    $modulePath = Join-Path $projectRoot $module
    if ($Build) {
        docker build --target development --tag $imageName $modulePath
        if ($LASTEXITCODE -ne 0) { throw "Image build failed: $module" }
    }
    $coveragePath = Join-Path $modulePath "coverage"
    New-Item -ItemType Directory -Force -Path $coveragePath | Out-Null
    Write-Host "Running isolated Jest unit tests: $module"
    docker run --rm --network none --mount "type=bind,source=$coveragePath,target=/app/coverage" $imageName npm run test:ci
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed: $module" }
}
