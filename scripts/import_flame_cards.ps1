param(
  [string]$InputXlsx = "d:\Downloads\火焰征程-卡片.xlsx",
  [string]$OutRawJson = "src/data/flameCards.json",
  [string]$OutBestJson = "src/data/flameCardsBest.json"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $InputXlsx)) {
  throw "Input file not found: $InputXlsx"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($InputXlsx)

try {
  $wbEntry = $zip.Entries | Where-Object FullName -eq "xl/workbook.xml"
  $sr = New-Object IO.StreamReader($wbEntry.Open())
  [xml]$wbXml = $sr.ReadToEnd()
  $sr.Close()

  $relsEntry = $zip.Entries | Where-Object FullName -eq "xl/_rels/workbook.xml.rels"
  $sr = New-Object IO.StreamReader($relsEntry.Open())
  [xml]$relsXml = $sr.ReadToEnd()
  $sr.Close()

  $ssEntry = $zip.Entries | Where-Object FullName -eq "xl/sharedStrings.xml"
  $shared = @()
  if ($ssEntry) {
    $sr = New-Object IO.StreamReader($ssEntry.Open())
    [xml]$ssXml = $sr.ReadToEnd()
    $sr.Close()
    foreach ($si in $ssXml.sst.si) {
      if ($si.t) { $shared += [string]$si.t }
      elseif ($si.r) { $shared += (($si.r | ForEach-Object { $_.t."#text" }) -join "") }
      else { $shared += "" }
    }
  }

  function CellVal($cell, $shared) {
    if (-not $cell) { return "" }
    $t = [string]$cell.t
    $v = if ($cell.v) { [string]$cell.v } else { "" }

    if ($t -eq "s") {
      $idx = 0
      [int]::TryParse($v, [ref]$idx) | Out-Null
      if ($idx -ge 0 -and $idx -lt $shared.Count) { return $shared[$idx] }
      return ""
    }

    if ($t -eq "inlineStr" -and $cell.is.t) {
      return [string]$cell.is.t
    }

    return $v
  }

  $sheetNode = $wbXml.workbook.sheets.sheet | Where-Object { $_.name -eq "卡片一覽" }
  if (-not $sheetNode) { throw "sheet '卡片一覽' not found" }

  $rid = $sheetNode.Attributes["r:id"].Value
  $rel = $relsXml.Relationships.Relationship | Where-Object { $_.Id -eq $rid }
  $target = "xl/" + ([string]$rel.Target).TrimStart("/")

  $entry = $zip.Entries | Where-Object FullName -eq $target
  $sr = New-Object IO.StreamReader($entry.Open())
  [xml]$sx = $sr.ReadToEnd()
  $sr.Close()

  $rows = @($sx.worksheet.sheetData.row) | Select-Object -Skip 2
  $cards = New-Object System.Collections.Generic.List[object]

  foreach ($row in $rows) {
    $vals = @()
    foreach ($c in @($row.c)) { $vals += (CellVal $c $shared) }
    if ($vals.Count -lt 8) { continue }

    $idRaw = [string]$vals[0]
    $name = [string]$vals[2]

    if ([string]::IsNullOrWhiteSpace($idRaw) -or [string]::IsNullOrWhiteSpace($name)) { continue }
    if ($name -like "(废弃)*") { continue }

    $id = [int][math]::Round([double]($idRaw -replace ",", ""))
    $quality = [int][math]::Round([double](([string]$vals[1]) -replace ",", ""))
    $cost = [int][math]::Round([double](([string]$vals[3]) -replace ",", ""))
    if ($cost -lt 0) { $cost = 0 }

    $hp = [int][math]::Round([double](([string]$vals[5]) -replace ",", ""))
    $atk = [int][math]::Round([double](([string]$vals[6]) -replace ",", ""))
    if ($hp -le 0 -or $atk -lt 0) { continue }

    $abilitySlots = @("", "", "", "", "")
    for ($i = 0; $i -lt 5; $i += 1) {
      $idx = 8 + $i
      if ($idx -lt $vals.Count) {
        $a = [string]$vals[$idx]
        if (-not [string]::IsNullOrWhiteSpace($a)) {
          $abilitySlots[$i] = $a.Trim()
        }
      }
    }

    $abilities = @($abilitySlots | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $desc = if ($abilities.Count -gt 0) { $abilities -join "；" } else { "" }

    $phyle = [int][math]::Round([double](([string]$vals[4]) -replace ",", ""))
    $uniq = ([int][math]::Round([double](([string]$vals[7]) -replace ",", "")) -eq 1)

    $cards.Add([pscustomobject]@{
      source = "flame_journey"
      sourceSheet = "卡片一覽"
      sourceId = $id
      id = "f_$id"
      name = $name.Trim()
      type = "summon"
      quality = $quality
      cost = $cost
      phyle = $phyle
      unique = $uniq
      description = $desc
      ability1 = $abilitySlots[0]
      ability2 = $abilitySlots[1]
      ability3 = $abilitySlots[2]
      ability4 = $abilitySlots[3]
      ability5 = $abilitySlots[4]
      abilities = @($abilities)
      image = ""
      unit = [pscustomobject]@{
        name = $name.Trim()
        hp = $hp
        atk = $atk
        range = 40
        speed = 35
        atkCdMs = 1000
      }
    })
  }

  $bestByName = @{}
  foreach ($c in $cards) {
    $k = [string]$c.name
    if (-not $bestByName.ContainsKey($k) -or $c.quality -gt $bestByName[$k].quality) {
      $bestByName[$k] = $c
    }
  }

  $cardsArr = @($cards.ToArray())
  $bestArr = @($bestByName.Values | Sort-Object name)

  $rawObj = [pscustomobject]@{
    version = 1
    importedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    totalRows = $cardsArr.Count
    bestByNameCount = $bestArr.Count
    cards = $cardsArr
    bestByName = $bestArr
  }

  $bestObj = [pscustomobject]@{
    version = 1
    importedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    source = "flame_journey"
    count = $bestArr.Count
    cards = $bestArr
  }

  $rawPath = Join-Path (Get-Location) $OutRawJson
  $bestPath = Join-Path (Get-Location) $OutBestJson

  $rawDir = Split-Path $rawPath -Parent
  $bestDir = Split-Path $bestPath -Parent
  if (!(Test-Path $rawDir)) { New-Item -ItemType Directory -Path $rawDir -Force | Out-Null }
  if (!(Test-Path $bestDir)) { New-Item -ItemType Directory -Path $bestDir -Force | Out-Null }

  ($rawObj | ConvertTo-Json -Depth 8) | Set-Content -Path $rawPath -Encoding utf8
  ($bestObj | ConvertTo-Json -Depth 8) | Set-Content -Path $bestPath -Encoding utf8

  Write-Host "Done"
  Write-Host "Raw:  $rawPath"
  Write-Host "Best: $bestPath"
  Write-Host "Rows: $($cardsArr.Count), BestByName: $($bestArr.Count)"
}
finally {
  $zip.Dispose()
}
