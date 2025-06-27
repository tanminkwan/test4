# 필요한 디렉터리 생성
if (-not (Test-Path ".cursor")) {
    New-Item -ItemType Directory -Path ".cursor" | Out-Null
}

# 노드 실행 파일 경로 찾기
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Path
if (-not $nodePath) {
    $nodePath = "node"  # 기본값으로 설정
}

# 현재 디렉터리의 절대 경로 가져오기
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$serverPath = Join-Path $projectDir "mcp-postgres-server.js"

# MCP 서버 구성 파일 생성
$mcp = @{
    mcpServers = @{
        "PostgreSQL MCP Server" = @{
            command = $nodePath
            args = @($serverPath)
            env = @{}
        }
    }
}

# JSON으로 변환 및 저장
$mcpJson = ConvertTo-Json $mcp -Depth 10
$mcpJson | Out-File -FilePath ".cursor/mcp.json" -Encoding utf8

Write-Host "MCP 설정이 업데이트되었습니다."
Write-Host "노드 경로: $nodePath"
Write-Host "서버 스크립트 경로: $serverPath" 