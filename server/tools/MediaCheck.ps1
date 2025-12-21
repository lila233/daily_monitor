# MediaCheck.ps1 - Check if any media is currently playing
# Uses Windows.Media.Control WinRT API

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Load WinRT types
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus, Windows.Media.Control, ContentType=WindowsRuntime]

# Helper function to await async operations
function Await-Task {
    param([System.Threading.Tasks.Task]$Task)
    $null = $Task.GetAwaiter().GetResult()
    return $Task.Result
}

try {
    # Get session manager
    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $sessionManager = Await-Task -Task $asyncOp

    if ($null -eq $sessionManager) {
        Write-Output "false"
        exit
    }

    # Get all sessions
    $sessions = $sessionManager.GetSessions()

    foreach ($session in $sessions) {
        $playbackInfo = $session.GetPlaybackInfo()
        if ($playbackInfo.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing) {
            Write-Output "true"
            exit
        }
    }

    Write-Output "false"
} catch {
    Write-Output "false"
}
