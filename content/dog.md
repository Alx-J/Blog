---
title: Dog
date: 2025-03-15
description: Easy Linux machine focused on extracting credentials from an exposed `.git` repository, abusing Backdrop CMS for authenticated RCE through a malicious module upload, pivoting via password reuse, and escalating privileges through the `bee` utility running with sudo permissions.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```bash
# Nmap 7.94SVN scan initiated Sun Mar  9 06:53:10 2025 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.10.11.58
Nmap scan report for 10.10.11.58
Host is up (0.26s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 97:2a:d2:2c:89:8a:d3:ed:4d:ac:00:d2:1e:87:49:a7 (RSA)
|   256 27:7c:3c:eb:0f:26:e9:62:59:0f:0f:b1:38:c9:ae:2b (ECDSA)
|_  256 93:88:47:4c:69:af:72:16:09:4c:ba:77:1e:3b:3b:eb (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-generator: Backdrop CMS 1 (https://backdropcms.org)
|_http-server-header: Apache/2.4.41 (Ubuntu)
```

The target exposed:

- `22/tcp` - SSH
- `80/tcp` - Apache hosting **Backdrop CMS 1**

No additional subdomains were identified during enumeration.

An exposed `.git` repository and `robots.txt` file were also discovered.

### Dumping the Repository

```bash
git-dumper http://dog.htb/.git/ ./git
```

Reviewing `settings.php` revealed credentials that appeared to be tied to the application database. The password looked like a strong candidate for credential reuse.

An email address recovered from the repository provided a potential login target.

# User

Using the discovered credentials:

```text
tiffany@dog.htb : BackDropJ2024DS2024
```

Authentication to the Backdrop CMS admin panel succeeded.

After reviewing the status report, the installed version was matched to a known vulnerability that allowed authenticated remote code execution through malicious module uploads.

### Module Upload RCE

The exploit generated a malicious module archive containing a PHP payload.

Navigate to:

```text
Administration → Install New Module → Manual Installation
```

The original archive format was rejected, so the exploit was modified to generate a `tar.gz` package instead.

After installation, accessing the module path exposed by the exploit allowed command execution.

A reverse shell was triggered, resulting in access as:

```text
www-data
```

## User Pivot

Local enumeration revealed two users on the system.

Since the password recovered from `settings.php` appeared reusable, it was tested against SSH and successfully authenticated as:

```text
johncusack : BackDropJ2024DS2024
```

# Root

The `johncusack` account could execute the `bee` utility with `sudo` privileges.

The utility supports execution of arbitrary PHP scripts, making privilege escalation straightforward.

![[/images/dog.png]]

Executing the script spawned a root shell.

Compromised Backdrop CMS through an authenticated module upload vulnerability, pivoted through password reuse, and escalated privileges via the `bee` utility's PHP execution functionality.

Gained `root`
