$SUPABASE_URL = "https://wcgdapjjzpzvjprzudyq.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2RhcGpqenB6dmpwcnp1ZHlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk1Nzg4MSwiZXhwIjoyMDgzNTMzODgxfQ.cZWWBFsnjGTNRi48clHb9uKkyYyeNB7rMTg5uNgs2mg"

$emails = @(
    "106@chuyi.com.tw", "107@chuyi.com.tw", "108@chuyi.com.tw", "109@chuyi.com.tw",
    "205@chuyi.com.tw", "207@chuyi.com.tw", "209@chuyi.com.tw",
    "303@chuyi.com.tw", "304@chuyi.com.tw", "306@chuyi.com.tw", "307@chuyi.com.tw", "308@chuyi.com.tw", "309@chuyi.com.tw", "310@chuyi.com.tw", "311@chuyi.com.tw", "314@chuyi.com.tw",
    "403@chuyi.com.tw", "405@chuyi.com.tw", "406@chuyi.com.tw", "409@chuyi.com.tw", "417@chuyi.com.tw", "418@chuyi.com.tw", "424@chuyi.com.tw", "425@chuyi.com.tw",
    "502@chuyi.com.tw", "504@chuyi.com.tw", "505@chuyi.com.tw", "506@chuyi.com.tw",
    "602@chuyi.com.tw", "604@chuyi.com.tw", "605@chuyi.com.tw", "606@chuyi.com.tw", "607@chuyi.com.tw"
)

Write-Host "🚀 Checking and creating missing users from Excel..." -ForegroundColor Cyan

foreach ($email in $emails) {
    $body = @{ email = $email; password = "123456"; email_confirm = $true } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users" -Method Post -Headers @{ "apikey" = $SERVICE_ROLE_KEY; "Authorization" = "Bearer $SERVICE_ROLE_KEY"; "Content-Type" = "application/json" } -Body $body
        Write-Host "✨ [NEW] Created: $email" -ForegroundColor Green
    } catch {
        Write-Host "✅ [OK] Exists: $email" -ForegroundColor Yellow
    }
}
Write-Host "All Auth accounts are ready!" -ForegroundColor Cyan
