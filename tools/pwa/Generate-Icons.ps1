# Deterministically resize the existing branding; no new artwork or external services.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$source = Join-Path $repo "Allport's League Scrambler/ClientApp/src/assets/img/sitelogo1.png"
$destination = Join-Path $repo "Allport's League Scrambler/ClientApp/src/assets/icons"
[IO.Directory]::CreateDirectory($destination) | Out-Null
$logo = [Drawing.Image]::FromFile($source)
try {
 foreach ($entry in @(@('icon-192',192,.92),@('icon-512',512,.92),@('apple-touch-icon',180,.92),@('maskable-192',192,.58),@('maskable-512',512,.58))) {
  $size=[int]$entry[1]; $image=New-Object Drawing.Bitmap($size,$size); $graphics=[Drawing.Graphics]::FromImage($image)
  try {
   $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#62676a'))
   $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $width=[single]($size*[double]$entry[2]); $height=[single]($width*$logo.Height/$logo.Width)
   $graphics.DrawImage($logo,[single](($size-$width)/2),[single](($size-$height)/2),$width,$height)
   $image.Save((Join-Path $destination ($entry[0]+'.png')),[Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $image.Dispose() }
 }
} finally { $logo.Dispose() }
