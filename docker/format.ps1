param([switch]$Write)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$operation = if ($Write) { "--write" } else { "--check" }
docker run --rm --network none --mount "type=bind,source=$projectRoot,target=/workspace" --workdir /workspace actionhub-frontend-dev /app/node_modules/.bin/prettier $operation .
if ($LASTEXITCODE -ne 0) { throw "Prettier failed. Use -Write to apply formatting, then rerun the check." }
