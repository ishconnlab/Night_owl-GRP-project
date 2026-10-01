-- Applies every migration in src/migrations in filename order.
--
--   npm run migrate
--
-- Each file is individually idempotent, so this is safe to re-run: it is the
-- expected way to pull schema changes onto an existing database.
--
-- Needs psql on PATH (ships with PostgreSQL) and DATABASE_URL in .env:
--   DATABASE_URL=postgres://user:password@host/db?sslmode=require

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
      $key = $matches[1]
      $value = $matches[2].Trim('"').Trim("'")
      if (-not [Environment]::GetEnvironmentVariable($key)) {
        [Environment]::SetEnvironmentVariable($key, $value)
      }
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Error 'DATABASE_URL is not set. Add it to .env before running migrations.'
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error 'psql was not found on PATH. Install the PostgreSQL client tools.'
  exit 1
}

$files = Get-ChildItem -LiteralPath (Join-Path $root 'src\migrations') -Filter '*.sql' |
  Sort-Object Name

foreach ($file in $files) {
  Write-Host "Applying $($file.Name)"
  # ON_ERROR_STOP=1 makes psql exit non-zero on the first error, which $ErrorActionPreference
  # then turns into a thrown exception instead of a silent partial migration.
  & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -q -f $file.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$($file.Name) failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
  }
}

Write-Host 'All migrations applied.'
