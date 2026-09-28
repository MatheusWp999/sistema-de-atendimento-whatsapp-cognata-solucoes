$ErrorActionPreference = "Stop"

Write-Host "Verificando Docker..."
try {
  docker info | Out-Null
} catch {
  Write-Error "Docker Desktop/daemon nao esta rodando. Abra o Docker Desktop e rode npm run setup:local novamente."
}

Write-Host "Subindo PostgreSQL/pgvector..."
docker compose up -d

Write-Host "Aguardando PostgreSQL em localhost:5432..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    "SELECT 1;" | npx prisma db execute --stdin | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $ready) {
  Write-Error "PostgreSQL nao respondeu em tempo habil. Verifique Docker e DATABASE_URL."
}

Write-Host "Aplicando schema Prisma..."
npx prisma db push
npx prisma generate

Write-Host "Executando backfills seguros..."
npm run conversations:dedupe
npm run conversations:backfill-aliases
npm run conversations:backfill-last-customer

Write-Host "Setup local concluido."
Write-Host "Inicie em terminais separados:"
Write-Host "  npm run dev"
Write-Host "  npm run worker:outbound"
Write-Host "  npm run worker:summary"
Write-Host "  npm run worker:whatsapp"
