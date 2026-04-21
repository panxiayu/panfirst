$ErrorActionPreference = 'Stop'

$server = "192.168.110.22"
$port = "2222"
$user = "openclaw"
$pass = "pan99612"

$key = Get-Content "$env:USERPROFILE\.ssh\id_exam.pub"

# 创建远程命令来添加公钥
$cmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$key' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Key added'"

# 使用 PowerShell 的 Start-Process 和 stdin 重定向
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "ssh"
$pinfo.Arguments = "-o StrictHostKeyChecking=no -o BatchMode=yes -p $port $user@$server `"$cmd`""
$pinfo.RedirectStandardInput = $true
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $pinfo
$process.Start() | Out-Null

# 等待连接
Start-Sleep -Seconds 2

# 如果需要密码，输入密码
if ($process.HasExited -eq $false) {
    $process.StandardInput.WriteLine($pass)
    $process.StandardInput.Flush()
}

$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

Write-Host "STDOUT: $stdout"
Write-Host "STDERR: $stderr"
Write-Host "Exit Code: $($process.ExitCode)"
