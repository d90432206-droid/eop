$SUPABASE_URL = "https://wcgdapjjzpzvjprzudyq.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2RhcGpqenB6dmpwcnp1ZHlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk1Nzg4MSwiZXhwIjoyMDgzNTMzODgxfQ.cZWWBFsnjGTNRi48clHb9uKkyYyeNB7rMTg5uNgs2mg"

$extra_emails = @(
    "110@chuyi.com.tw", "111@chuyi.com.tw", "112@chuyi.com.tw", "113@chuyi.com.tw", "114@chuyi.com.tw",
    "208@chuyi.com.tw", "210@chuyi.com.tw", "211@chuyi.com.tw",
    "301@chuyi.com.tw", "302@chuyi.com.tw", "305@chuyi.com.tw",
    "402@chuyi.com.tw", "404@chuyi.com.tw", "408@chuyi.com.tw", "410@chuyi.com.tw"
)

Write-Host "🔍 Fetching all users to find IDs..." -ForegroundColor Cyan

$headers = @{
    "apikey" = $SERVICE_ROLE_KEY
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
}

$response = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users" -Method Get -Headers $headers
$users = $response.users

$count = 0
foreach ($email in $extra_emails) {
    $target = $users | Where-Object { $_.email -eq $email }
    if ($target) {
        $userId = $target.id
        Write-Host "🗑️ Deleting $email ($userId)..." -ForegroundColor Red
        try {
            Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/admin/users/$userId" -Method Delete -Headers $headers
            Write-Host "✅ Deleted success." -ForegroundColor Green
            $count++
        } catch {
            Write-Host "❌ Failed to delete $email" -ForegroundColor Gray
        }
    } else {
        Write-Host "❓ Not found: $email" -ForegroundColor Yellow
    }
}

Write-Host "Done! Deleted $count users." -ForegroundColor Cyan
