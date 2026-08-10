param([string]$OutputPath)
$ErrorActionPreference = "Stop"
$outputPath = if ($OutputPath) { $OutputPath } else { Join-Path (Get-Location) 'AI-Portal.exe' }
$source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

class Launcher
{
    static void Log(string logPath, string message)
    {
        File.AppendAllText(logPath, DateTime.Now.ToString("s") + " " + message + Environment.NewLine);
    }

    static int Main()
    {
        string project = AppDomain.CurrentDomain.BaseDirectory;
        string logPath = Path.Combine(project, "AI-Portal-launcher.log");
        Log(logPath, "Launcher started: " + project);
        if (!File.Exists(Path.Combine(project, "package.json")))
        {
            Log(logPath, "ERROR: package.json was not found. Place AI-Portal.exe in the project folder.");
            return 1;
        }

        string mutexName = "Local\\AI-Portal-" + project.Replace('\\', '_').Replace(':', '_');
        bool createdNew;
        using (var mutex = new Mutex(true, mutexName, out createdNew))
        {
            if (!createdNew)
            {
                Console.WriteLine("AI-Portal is already running; duplicate launch ignored.");
                return 0;
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                    Arguments = "/d /c \"set NODE_ENV=production&& set NEXT_TELEMETRY_DISABLED=1&& npm.cmd run start:all\"",
                    WorkingDirectory = project,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                Process process = Process.Start(psi);
                if (process == null)
                {
                    Log(logPath, "ERROR: Process.Start returned null.");
                    return 1;
                }
                process.OutputDataReceived += (sender, e) => { if (e.Data != null) Log(logPath, "OUT " + e.Data); };
                process.ErrorDataReceived += (sender, e) => { if (e.Data != null) Log(logPath, "ERR " + e.Data); };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                process.WaitForExit();
                Log(logPath, "Launcher child exited: " + process.ExitCode);
                return process.ExitCode;
            }
            catch (Exception ex)
            {
                Log(logPath, "ERROR: " + ex);
                return 1;
            }
        }
    }
}
'@
Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $outputPath -OutputType ConsoleApplication
if (Test-Path $outputPath) { Write-Output "EXE_BUILT: $outputPath" } else { Write-Output 'FAILED' }
