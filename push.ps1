param (
    [string]$msg = "auto commit"
)

git add .
git commit -m $msg
git push gitee
git push github

Write-Host "Pushed to both Gitee and GitHub successfully." -ForegroundColor Green
