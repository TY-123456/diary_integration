$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()

function Get-MimeType($path) {
    switch -Regex ($path) {
        "\.html?$" { return "text/html; charset=utf-8" }
        "\.css$" { return "text/css; charset=utf-8" }
        "\.js$" { return "application/javascript; charset=utf-8" }
        "\.json$" { return "application/json; charset=utf-8" }
        "\.webmanifest$" { return "application/manifest+json; charset=utf-8" }
        "\.svg$" { return "image/svg+xml" }
        default { return "application/octet-stream" }
    }
}

function Send-Response($stream, $status, $contentType, [byte[]]$body) {
    $reason = if ($status -eq 200) { "OK" } elseif ($status -eq 404) { "Not Found" } else { "Bad Request" }
    $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
}

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $buffer = New-Object byte[] 4096
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { continue }

        $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
        $firstLine = ($request -split "`r?`n")[0]
        if ($firstLine -notmatch "^(GET|HEAD) ([^ ]+) HTTP/") {
            Send-Response $stream 400 "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Bad request"))
            continue
        }

        $urlPath = [Uri]::UnescapeDataString($Matches[2].Split("?")[0])
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        $relative = $urlPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
        $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))

        if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            Send-Response $stream 404 "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
            continue
        }

        $body = [System.IO.File]::ReadAllBytes($fullPath)
        Send-Response $stream 200 (Get-MimeType $fullPath) $body
    }
    catch {
        try {
            Send-Response $stream 400 "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Server error"))
        } catch {}
    }
    finally {
        $client.Close()
    }
}
