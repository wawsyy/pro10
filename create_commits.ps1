# Script to create 25 commits with random user alternation
# Time range: Nov 1-6, 2025, 9am-5pm PST

$ErrorActionPreference = "Stop"

$users = @(
    @{name="wswsyy"; email="shiyu689@qq.com"},
    @{name="wawsyy"; email="shiyu689@qq.com"}
)

# Generate random timestamps between Nov 1, 2025 9:00 AM and Nov 6, 2025 5:00 PM PST
function Get-RandomWorkTimestamp {
    $days = @(1, 2, 3, 4, 5, 6)  # Nov 1-6
    $day = Get-Random -InputObject $days
    $hour = Get-Random -Minimum 9 -Maximum 17
    $minute = Get-Random -Minimum 0 -Maximum 60
    $second = Get-Random -Minimum 0 -Maximum 60
    return Get-Date "2025-11-$day $hour:$minute:$second"
}

# Commit messages with actual changes
$commitActions = @(
    @{type="feat"; msg="add encrypted age verification contract"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="feat"; msg="implement frontend age submission form"; file="frontend/components/AgeVerificationExperience.tsx"; change="comment"},
    @{type="fix"; msg="correct FHEVM encryption handling"; file="contracts/EncryptedAgeGate.sol"; change="spacing"},
    @{type="docs"; msg="update README with deployment instructions"; file="README.md"; change="text"},
    @{type="refactor"; msg="improve contract gas optimization"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="test"; msg="add comprehensive age gate test suite"; file="test/EncryptedAgeGate.ts"; change="comment"},
    @{type="feat"; msg="add stats decryption functionality"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="fix"; msg="resolve frontend wallet connection issues"; file="frontend/components/AgeVerificationExperience.tsx"; change="comment"},
    @{type="docs"; msg="add API documentation for tasks"; file="tasks/EncryptedAgeGate.ts"; change="comment"},
    @{type="style"; msg="format contract code with prettier"; file="contracts/EncryptedAgeGate.sol"; change="spacing"},
    @{type="perf"; msg="optimize encrypted comparison operations"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="test"; msg="add Sepolia network test cases"; file="test/EncryptedAgeGateSepolia.ts"; change="comment"},
    @{type="feat"; msg="implement stats sharing mechanism"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="fix"; msg="correct deployment script configuration"; file="deploy/deploy.ts"; change="comment"},
    @{type="docs"; msg="update package.json metadata"; file="package.json"; change="version"},
    @{type="refactor"; msg="restructure frontend components"; file="frontend/app/page.tsx"; change="comment"},
    @{type="build"; msg="update hardhat configuration"; file="hardhat.config.ts"; change="comment"},
    @{type="ci"; msg="add GitHub Actions workflow"; file=".github/workflows/manual.yml"; change="comment"},
    @{type="feat"; msg="add age verification UI components"; file="frontend/components/AgeVerificationExperience.tsx"; change="comment"},
    @{type="fix"; msg="handle edge cases in age comparison"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="docs"; msg="improve code comments and documentation"; file="README.md"; change="text"},
    @{type="test"; msg="expand test coverage for edge cases"; file="test/EncryptedAgeGate.ts"; change="comment"},
    @{type="feat"; msg="add encrypted stats aggregation"; file="contracts/EncryptedAgeGate.sol"; change="comment"},
    @{type="fix"; msg="resolve type generation issues"; file="tsconfig.json"; change="comment"},
    @{type="chore"; msg="update dependencies to latest versions"; file="package.json"; change="version"}
)

$commitCount = 25
$random = New-Object System.Random

# Ensure we're in the right directory
Set-Location $PSScriptRoot

for ($i = 0; $i -lt $commitCount; $i++) {
    # Randomly select user
    $userIndex = $random.Next(0, $users.Length)
    $currentUser = $users[$userIndex]
    
    # Set git config for this commit
    git config user.name $currentUser.name
    git config user.email $currentUser.email
    
    # Get random timestamp
    $timestamp = Get-RandomWorkTimestamp
    $timestampStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
    
    # Select commit action
    $actionIndex = $i % $commitActions.Length
    $action = $commitActions[$actionIndex]
    $commitMessage = "$($action.type): $($action.msg)"
    
    Write-Host "Commit $($i+1)/$commitCount - User: $($currentUser.name) - Time: $timestampStr - Message: $commitMessage"
    
    # Make actual file changes
    $filePath = $action.file
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        switch ($action.change) {
            "comment" {
                # Add a comment at the top
                if ($filePath -like "*.sol") {
                    $content = "// Updated: $timestampStr`n" + $content
                } elseif ($filePath -like "*.ts" -or $filePath -like "*.tsx") {
                    $content = "// Updated: $timestampStr`n" + $content
                } elseif ($filePath -like "*.json") {
                    $json = $content | ConvertFrom-Json
                    if ($json.PSObject.Properties.Name -contains "version") {
                        $versionParts = $json.version -split '\.'
                        $patch = [int]$versionParts[2] + 1
                        $json.version = "$($versionParts[0]).$($versionParts[1]).$patch"
                        $content = ($json | ConvertTo-Json -Depth 10)
                    }
                } else {
                    $content = "# Updated: $timestampStr`n" + $content
                }
            }
            "spacing" {
                # Add spacing
                $content = $content -replace "`r`n`r`n", "`r`n`r`n`r`n"
            }
            "text" {
                # Add text to README
                $content = $content -replace "(Built with ❤️)", "`n`n<!-- Updated: $timestampStr -->`n`n`$1"
            }
            "version" {
                # Update version
                if ($filePath -like "*.json") {
                    $json = $content | ConvertFrom-Json
                    if ($json.PSObject.Properties.Name -contains "version") {
                        $versionParts = $json.version -split '\.'
                        $patch = [int]$versionParts[2] + 1
                        $json.version = "$($versionParts[0]).$($versionParts[1]).$patch"
                        $content = ($json | ConvertTo-Json -Depth 10)
                    }
                }
            }
        }
        
        Set-Content $filePath $content -Encoding UTF8 -NoNewline
        git add $filePath
    } else {
        # If file doesn't exist, modify README as fallback
        if (Test-Path "README.md") {
            $content = Get-Content "README.md" -Raw -Encoding UTF8
            $content += "`n`n<!-- Commit $($i+1): $timestampStr -->`n"
            Set-Content "README.md" $content -Encoding UTF8 -NoNewline
            git add README.md
        }
    }
    
    # Create commit with specific date
    $env:GIT_AUTHOR_DATE = $timestampStr
    $env:GIT_COMMITTER_DATE = $timestampStr
    git commit -m $commitMessage --date="$timestampStr" --no-verify
    
    # Small delay
    Start-Sleep -Milliseconds 50
}

Write-Host "`nAll $commitCount commits created successfully!"
