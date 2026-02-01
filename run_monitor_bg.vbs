' Daily Monitor Startup Script
' This script runs the Daily Monitor server in the background.
' You can copy this file to your Windows Startup folder.
' (Win+R -> shell:startup)

Option Explicit

Dim fso, shell, scriptDir, targetDir, projectPath

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' 1. Determine the Project Directory
'    By default, assume the script is located INSIDE the project folder.
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectPath = scriptDir

' 2. Check if we are separated from the project (e.g. script was moved to Startup)
'    We check for "package.json" to verify if we are in the project root.
If Not fso.FileExists(fso.BuildPath(projectPath, "package.json")) Then
    ' We are not in the project folder. Use the hardcoded fallback path.
    ' [IMPORTANT] If you are distributing this, this path must match the installation.
    projectPath = "c:\Proj\daily_monitor"
End If

' 3. Verify the Project Directory exists and is valid
If Not fso.FolderExists(projectPath) Or Not fso.FileExists(fso.BuildPath(projectPath, "package.json")) Then
    MsgBox "Daily Monitor Error:" & vbCrLf & vbCrLf & _
           "Could not find the project folder at: " & vbCrLf & _
           projectPath & vbCrLf & vbCrLf & _
           "If you moved this script to the Startup folder, please right-click it, select Edit, " & _
           "and update the 'projectPath' variable to your installation directory.", _
           16, "Daily Monitor startup failed"
    WScript.Quit
End If

' 4. Run the application
On Error Resume Next
shell.CurrentDirectory = projectPath
' Run "npm start" in hidden mode (0), don't wait for return (False)
shell.Run "npm start", 0, False

If Err.Number <> 0 Then
    MsgBox "Failed to enforce current directory or run command." & vbCrLf & _
           "Error: " & Err.Description, 16, "Daily Monitor Error"
End If
On Error Goto 0
