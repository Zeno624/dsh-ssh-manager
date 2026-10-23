# Rebuild askpass.exe used by the Host half to answer ssh password prompts.
# The Host sets SSH_ASKPASS to this executable and passes the password in
# DSH_SSH_ASKPASS_VALUE, so the password never appears on a command line.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'askpass.exe'
$source = @'
using System;
public class DshSshAskpass {
  public static void Main() {
    Console.Out.Write(Environment.GetEnvironmentVariable("DSH_SSH_ASKPASS_VALUE") ?? "");
  }
}
'@
Add-Type -TypeDefinition $source -OutputAssembly $out -OutputType ConsoleApplication
Write-Host "built $out"
