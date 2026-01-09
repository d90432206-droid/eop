$SUPABASE_URL = "https://wcgdapjjzpzvjprzudyq.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2RhcGpqenB6dmpwcnp1ZHlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk1Nzg4MSwiZXhwIjoyMDgzNTMzODgxfQ.cZWWBFsnjGTNRi48clHb9uKkyYyeNB7rMTg5uNgs2mg"

$emails = @(
    "106@chuyi.com.tw", "107@chuyi.com.tw", "108@chuyi.com.tw", "109@chuyi.com.tw", "110@chuyi.com.tw",
    "111@chuyi.com.tw", "112@chuyi.com.tw", "113@chuyi.com.tw", "114@chuyi.com.tw", "205@chuyi.com.tw",
    "207@chuyi.com.tw", "208@chuyi.com.tw", "209@chuyi.com.tw", "210@chuyi.com.tw", "211@chuyi.com.tw",
    "301@chuyi.com.tw", "302@chuyi.com.tw", "303@chuyi.com.tw", "304@chuyi.com.tw", "305@chuyi.com.tw",
    "306@chuyi.com.tw", "307@chuyi.com.tw", "308@chuyi.com.tw", "309@chuyi.com.tw", "310@chuyi.com.tw",
    "402@chuyi.com.tw", "403@chuyi.com.tw", "404@chuyi.com.tw", "405@chuyi.com.tw", "406@chuyi.com.tw",
    "408@chuyi.com.tw", "409@chuyi.com.tw", "410@chuyi.com.tw"
)

Write-Host "Starting bulk user creation..." -ForegroundColor Cyan

foreach ($email in $emails) {
    $body = @{
        email = $email
        password = "123456"
        email_confirm = $true
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users" `
            -Method Post `
            -Headers @{ 
                "apikey" = $SERVICE_ROLE_KEY 
                "Authorization" = "Bearer $SERVICE_ROLE_KEY"
                "Content-Type" = "application/json"
            } `
            -Body $body

        Write-Host "[SUCCESS] Created: $email" -ForegroundColor Green
    } catch {
        $res = $_.Exception.Response
        if ($res.StatusCode -eq "UnprocessableEntity") { 
            Write-Host "[SKIP] Already exists: $email" -ForegroundColor Yellow
        } else {
            Write-Host "[ERROR] Failed: $email - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "All set! You can now try to login." -ForegroundColor Cyan
