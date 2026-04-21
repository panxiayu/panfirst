# PowerShell SSH with password using .NET
$server = "192.168.110.22"
$port = "2222"
$user = "openclaw"
$pass = "pan99612"
$key = Get-Content "$env:USERPROFILE\.ssh\id_exam.pub"

# Create SSH connection using .NET
Add-Type -AssemblyName System.Net.Sockets

$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect($server, [int]$port)
    Write-Host "Connected to $server`:$port"
} catch {
    Write-Host "Failed to connect: $_"
    exit 1
}

# We can't do password auth manually easily
# Let's try using cmd with /c
$cmd = @"
mkdir -p .ssh 2>nul
echo $key >> .ssh\authorized_keys 2>nul
echo Key added
"@

$proc = Start-Process -FilePath "cmd" -ArgumentList "/c","echo $pass | ssh -o StrictHostKeyChecking=no -p $port $user@$server `"mkdir -p .ssh && echo '$key' >> .ssh/authorized_keys`"" -NoNewWindow -Wait -PassThru
