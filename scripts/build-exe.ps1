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
    static int Main()
    {
        string project = AppDomain.CurrentDomain.BaseDirectory;
        if (!File.Exists(Path.Combine(project, "package.json")))
        {
            Console.WriteLine("[ERROR] AI-Portal.exe must be placed in the project folder.");
            Console.ReadLine();
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
                    FileName = "npm.cmd",
                    Arguments = "run start:all",
                    WorkingDirectory = project,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                Process process = Process.Start(psi);
                if (process == null)
                {
                    Console.WriteLine("[ERROR] Could not start AI-Portal. Make sure Node.js is installed.");
                    Console.ReadLine();
                    return 1;
                }
                process.WaitForExit();
                return process.ExitCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine("[ERROR] " + ex.Message + "\n\nIs Node.js installed?\nGet it at https://nodejs.org");
                Console.ReadLine();
                return 1;
            }
        }
    }
}
'@
Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $outputPath -OutputType ConsoleApplication
if (Test-Path $outputPath) { Write-Output "EXE_BUILT: $outputPath" } else { Write-Output 'FAILED' }
