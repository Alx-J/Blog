---
title: Nocturnal
date: 2025-07-10
description: Exploited an IDOR vulnerability to access user files and recover credentials, leveraged command injection in the backup functionality for initial access, pivoted through cracked database hashes to SSH as tobias, and escalated to root through ISPConfig CVE-2023-46818.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.94SVN scan initiated Sun Jul  6 22:46:24 2025 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.10.11.64
Nmap scan report for nocturnal.htb (10.10.11.64)
Host is up (0.32s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 20:26:88:70:08:51:ee:de:3a:a6:20:41:87:96:25:17 (RSA)
|   256 4f:80:05:33:a6:d4:22:64:e9:ed:14:e3:12:bc:96:f1 (ECDSA)
|_  256 d9:88:1f:68:43:8e:d4:2a:52:fc:f0:66:d4:b9:ee:6b (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Linux 4.15 - 5.8 (95%), Linux 5.0 - 5.4 (95%), Linux 5.3 - 5.4 (95%), Linux 2.6.32 (95%), Linux 5.0 (95%), Linux 5.0 - 5.5 (95%), Linux 3.1 (94%), Linux 3.2 (94%), AXIS 210A or 211 Network Camera (Linux 2.6.17) (94%), HP P2000 G3 NAS device (93%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   311.24 ms 10.10.14.1
2   313.07 ms nocturnal.htb (10.10.11.64)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sun Jul  6 22:47:02 2025 -- 1 IP address (1 host up) scanned in 37.50 seconds
```

```txt
200      GET       21l       45w      644c http://nocturnal.htb/login.php
200      GET       21l       45w      649c http://nocturnal.htb/register.php
200      GET       21l       45w      649c http://nocturnal.htb/upload.php
403      GET        7l       10w      162c http://nocturnal.htb/uploads
200      GET      161l      327w     3105c http://nocturnal.htb/style.css
200      GET       29l      145w     1524c http://nocturnal.htb/
301      GET        7l       12w      178c http://nocturnal.htb/backups
```

Identified SSH and HTTP services exposed on the target. Directory enumeration revealed login, registration, uploads, and backup-related functionality.

# User

After registering a user and testing the upload feature, it became clear that uploaded files could be accessed through a predictable URL structure.

Leveraging an **IDOR** vulnerability in the file viewer allowed enumeration of valid users. Response length analysis with Burp Suite Intruder identified **amanda** as a user with accessible files.

Downloaded `privacy.odt`, extracted its contents, and searched for sensitive data:

```
privacy
├── Configurations2
│   ├── accelerator
│   ├── floater
│   ├── images
│   │   └── Bitmaps
│   ├── menubar
│   ├── popupmenu
│   ├── progressbar
│   ├── statusbar
│   ├── toolbar
│   └── toolpanel
├── content.xml
├── manifest.rdf
├── META-INF
│   └── manifest.xml
├── meta.xml
├── mimetype
├── settings.xml
├── styles.xml
└── Thumbnails
    └── thumbnail.png
```


`grep -ir "password" privacy/*`

Recovered credentials:

`amanda : arHkG7HAI68X8s1J`

## Admin Panel Enumeration

Authenticated as **amanda** and reviewed the administrative interface.

The panel exposed application source code and a backup feature. Reviewing the source revealed database interaction and backup functionality that accepted user-controlled input.

## Command Injection

Intercepted the backup request with Burp Suite and identified a command injection vulnerability.

Special characters such as `\n`, `\r`, and `\t` were used to break out of the intended command context and execute arbitrary commands.

The vulnerability was leveraged to dump the SQLite database:

`sqlite3 /var/www/nocturnal_database/nocturnal_database.db`


```txt
9 INSERT INTO users VALUES(1, 'admin', d725aeba143f575736b07045d8ceebb' );
10 INSERT INTO users VALUES(2, 'amanda', 'df8b20aa0c935023f99ea58358fb63c4');
11 INSERT INTO users VALUES(4, 'tobias', '55c82b1ccd55ab219b3b109b07d5061d');
12 INSERT INTO users VALUES(6, 'kavi', 'f38cde1654b39fea2bd4f72f1ae4cdda');
13 INSERT INTO users VALUES(7, ' e0Al5','101ad4543a96a7fd84908fd0d802e7db');
14 INSERT INTO users VALUES(8, 'nigga' VALUES(8, 'nigga', '1749f2802381694c23375c61e2bcb7d7');
15 INSERT INTO users VALUES(9, 'toto' VALUES(10, 'test','f71dbe52628a3f83a77ab494817525c6');
16 INSERT INTO users VALUES(10, 'test', 098f6bcd4621d373cade4832627b4f6');
```
Extracted password hashes and cracked them using CrackStation, recovering credentials for **tobias**.

Captured access as **tobias**.

# Root

## Lateral Movement

Local enumeration revealed an internal service listening on port `8080`.

Using SSH port forwarding exposed the service locally. Authentication succeeded through password reuse, providing access to an ISPConfig administrative interface.

> Version identification confirmed: `ISPConfig 3.2`

## Privilege Escalation

Research identified **CVE-2023-46818**, a code execution vulnerability affecting ISPConfig.

The exploit was used to obtain PHP code execution and a limited web shell.

Generated an SSH key pair and wrote the public key into root's `authorized_keys` file through the available command execution primitive.

Gained `Root`