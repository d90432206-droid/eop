$SUPABASE_URL = "https://wcgdapjjzpzvjprzudyq.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2RhcGpqenB6dmpwcnp1ZHlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk1Nzg4MSwiZXhwIjoyMDgzNTMzODgxfQ.cZWWBFsnjGTNRi48clHb9uKkyYyeNB7rMTg5uNgs2mg"

$employees = @(
    "106", "107", "108", "109", "205", "207", "209", "303", "304", "306", 
    "307", "308", "309", "310", "311", "314", "403", "405", "406", "409", 
    "417", "418", "424", "425", "502", "504", "505", "506", "602", "604", 
    "605", "606", "607"
)

Write-Host "🚀 Batch password reset (Password = Double ID, e.g., 106106)..." -ForegroundColor Cyan

# 預先抓取所有使用者清單，避免在循環中重複請求
$allUsersResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users?per_page=1000" `
    -Method Get `
    -Headers @{ "apikey" = $SERVICE_ROLE_KEY; "Authorization" = "Bearer $SERVICE_ROLE_KEY" }

foreach ($id in $employees) {
    $email = "$id@chuyi.com.tw"
    $targetUser = $allUsersResponse.users | Where-Object { $_.email -eq $email }

    if ($targetUser) {
        $uuid = $targetUser.id
        $newPassword = "$id$id" # e.g. 106106
        $body = @{ password = $newPassword } | ConvertTo-Json

        try {
            Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users/$uuid" `
                -Method Put `
                -Headers @{ 
                    "apikey" = $SERVICE_ROLE_KEY 
                    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
                    "Content-Type" = "application/json"
                } `
                -Body $body

            Write-Host "[SUCCESS] $email -> Password set to: $newPassword" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to update $email : $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "[SKIP] User $email not found in Auth table." -ForegroundColor Yellow
    }
}

Write-Host "Done! Passwords have been set to (ID+ID)." -ForegroundColor Cyan
