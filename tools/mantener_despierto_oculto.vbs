' RutaScan - lanza el keep-alive sin ventana visible.
' WScript.Shell.Run con estilo 0 crea la consola oculta desde el
' principio, asi que no hay destello. El -WindowStyle Hidden de
' powershell, por si solo, siempre destella un instante.
' El resto del mecanismo no cambia: MANTENER DESPIERTO.bat sigue
' valiendo para instalar o quitar el respaldo de esta PC.
Dim carpeta, shell
carpeta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & carpeta & "mantener_despierto.ps1"" -Ping", 0, False
