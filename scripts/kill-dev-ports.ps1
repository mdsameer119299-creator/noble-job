# Stops Node processes listening on Next.js dev ports (3000-3005)
$ports = 3000..3005
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped PID $_ on port $port"
    }
}
