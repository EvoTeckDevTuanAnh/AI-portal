$ErrorActionPreference = "Stop"
$src = @'
using System;
using System.Diagnostics;
using System.IO;

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

        try
        {
            // start:all boots the bridge (opens the ChatGPT browser profile) and the
            // web app, waits for both to be reachable, then opens the browser at :3000.
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npm run start:all",
                WorkingDirectory = project,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = false
            };
            Process p = Process.Start(psi);
            if (p == null)
            {
                Console.WriteLine("[ERROR] Could not start AI-Portal.\nMake sure Node.js is installed.");
                Console.ReadLine();
                return 1;
            }
            p.WaitForExit();
            return p.ExitCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine("[ERROR] " + ex.Message + "\n\nIs Node.js installed?\nGet it at https://nodejs.org");
            Console.ReadLine();
            return 1;
        }
    }
}
'@
Add-Type -TypeDefinition $src -Language CSharp -OutputAssembly 'C:\Users\ACER\AppData\Local\Temp\opencode\AI-Portal.exe' -OutputType ConsoleApplication
if (Test-Path 'C:\Users\ACER\AppData\Local\Temp\opencode\AI-Portal.exe') { Write-Output 'EXE_BUILT' } else { Write-Output 'FAILED' }