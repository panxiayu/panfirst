$ErrorActionPreference = 'Stop'

$proc = Start-Process -FilePath "git" -ArgumentList "push", "origin", "master" -NoNewWindow -Wait -PassThru -RedirectStandardInput "D:\exam\server\temp_input.txt"

Remove-Item "D:\exam\server\temp_input.txt" -ErrorAction SilentlyContinue
