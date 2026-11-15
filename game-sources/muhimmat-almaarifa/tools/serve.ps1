# Local static server for Windows (no installs needed). Used by run-windows.bat
param([string]$Root = "dist", [int]$Port = 8080)
$Root = (Resolve-Path $Root).Path
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".webp"="image/webp"; ".png"="image/png"; ".jpg"="image/jpeg"; ".svg"="image/svg+xml"; ".glb"="model/gltf-binary"; ".woff2"="font/woff2"; ".woff"="font/woff"; ".txt"="text/plain; charset=utf-8" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "Port $Port is busy. Close the other program or edit the port in run-windows.bat"; Read-Host "Press Enter"; exit 1 }
Write-Host "Muhimmat Al-Maarifa is running:  http://localhost:$Port/"
Write-Host "Keep this window open while playing. Close it to stop."
Start-Process "http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq "") { $path = "index.html" }
    $file = [System.IO.Path]::GetFullPath((Join-Path $Root $path))
    if ($file.StartsWith($Root) -and (Test-Path $file -PathType Container)) { $file = Join-Path $file "index.html" }
    if ($file.StartsWith($Root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] } else { $ctx.Response.ContentType = "application/octet-stream" }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  $ctx.Response.Close()
}
