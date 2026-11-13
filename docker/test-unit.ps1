# Run all services: .\docker\test-unit.ps1
# Run one service:  .\docker\test-unit.ps1 -Service hooks
# Add -Build only when you need to rebuild the selected service images first.
param(
    [ValidateSet("frontend", "primary-backend", "hooks", "processor", "worker")]
    [string[]]$Service = @("frontend", "primary-backend", "hooks", "processor", "worker"),
    [switch]$Build
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
# Test each selected service separately, using its existing development image.
foreach ($module in $Service) {
    $imageName = "actionhub-$module-dev"
    $modulePath = Join-Path $projectRoot $module
    if ($Build) {
        docker build --target development --tag $imageName $modulePath
        if ($LASTEXITCODE -ne 0) { throw "Image build failed: $module" }
    }
    # Save coverage on your PC even though the temporary test container is removed.
    $coveragePath = Join-Path $modulePath "coverage"
    New-Item -ItemType Directory -Force -Path $coveragePath | Out-Null
    Write-Host "Running isolated Jest unit tests: $module"
    # --rm removes the test container; --network none keeps unit tests isolated.
    docker run --rm --network none --mount "type=bind,source=$coveragePath,target=/app/coverage" $imageName npm run test:ci
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed: $module" }
}
