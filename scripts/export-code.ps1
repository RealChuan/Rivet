<#
.SYNOPSIS
Export all code files in a repository to a single file with path markers
#>

param(
    [string]$SourceDir = (Split-Path -Path $PSScriptRoot -Parent),
    [string]$OutputFile = "$PSScriptRoot\code-export.txt"
)

$includeExtensions = @(".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".yml", ".yaml")
$excludeDirs = @("node_modules", ".git", "dist", "build", ".next", ".vscode", ".idea", "coverage", ".github", "__pycache__", "release", "scripts")

$outputDir = [System.IO.Path]::GetDirectoryName($OutputFile)
if ($outputDir -ne "" -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path $OutputFile) {
    Remove-Item $OutputFile -Force -ErrorAction SilentlyContinue
}

function Test-ExcludeDir {
    param([string]$DirPath)
    foreach ($exclude in $excludeDirs) {
        if ($DirPath -match "\\$exclude\\") {
            return $true
        }
        if ($DirPath.EndsWith("\$exclude")) {
            return $true
        }
    }
    return $false
}

$files = @()
Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
    $ext = $_.Extension.ToLower()
    if ($includeExtensions -contains $ext) {
        if (-not (Test-ExcludeDir $_.DirectoryName)) {
            $files += $_
        }
    }
}

Write-Host "Found $($files.Count) files to process..."

$allContent = ""
$fileCounter = 0
$errorCount = 0

foreach ($file in $files) {
    $fileCounter++
    
    $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart("\", "/")
    
    $header = "`n" + ("=" * 80) + "`n"
    $header += "FILE: $relativePath`n"
    $header += "SIZE: $($file.Length) bytes`n"
    $header += ("=" * 80) + "`n"
    
    $footer = "`n" + ("=" * 80) + "`n"
    $footer += "END OF: $relativePath`n"
    $footer += ("=" * 80) + "`n`n"
    
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        $allContent += $header + $content + $footer
    }
    catch {
        Write-Warning "Cannot read file: $($file.FullName)"
        $errorCount++
        continue
    }
    
    if ($fileCounter % 50 -eq 0) {
        Write-Host "Processed $fileCounter / $($files.Count) files..."
    }
}

try {
    [System.IO.File]::WriteAllText($OutputFile, $allContent, [System.Text.Encoding]::UTF8)
    Write-Host "`nExport completed! Processed $fileCounter files"
    if ($errorCount -gt 0) {
        Write-Host "Errors: $errorCount files skipped"
    }
    Write-Host "Output file: $OutputFile"
}
catch {
    Write-Error "Failed to write output file: $_"
}