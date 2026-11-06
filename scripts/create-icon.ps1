$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'imagem_2026-11-05_212845945.ico'
$destination = Join-Path $root 'build\icon.ico'
$icon = [System.Drawing.Icon]::new($source)
$original = $icon.ToBitmap()
$large = [System.Drawing.Bitmap]::new(256,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($large)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.DrawImage($original,[System.Drawing.Rectangle]::new(0,0,256,256),0,0,$original.Width,$original.Height,[System.Drawing.GraphicsUnit]::Pixel)
$stream = [System.IO.MemoryStream]::new()
$large.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
$png = $stream.ToArray()
$raw = [System.IO.File]::ReadAllBytes($source)
$smallSize = [BitConverter]::ToUInt32($raw,14)
$smallOffset = [BitConverter]::ToUInt32($raw,18)
New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null
$output = [System.IO.File]::Create($destination)
$writer = [System.IO.BinaryWriter]::new($output)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]2)
  $writer.Write([byte]32); $writer.Write([byte]32); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$smallSize); $writer.Write([uint32]38)
  $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32](38+$smallSize))
  $writer.Write($raw,[int]$smallOffset,[int]$smallSize)
  $writer.Write($png)
} finally {
  $writer.Dispose(); $stream.Dispose(); $graphics.Dispose(); $large.Dispose(); $original.Dispose(); $icon.Dispose()
}
Write-Output "Ícone gerado: $destination"
