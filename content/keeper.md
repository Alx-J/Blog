---
title: Keeper
date: 2026-09-25
description: Easy Linux box logging into Request Tracker's default root password, dumping a KeePass memory file with CVE-2023-32784 for the database key, and converting the root PuTTY key with puttygen.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Sep 25 04:36:55 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.229.41
Nmap scan report for keeper.htb (10.129.229.41)
Host is up (0.71s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 35:39:d4:39:40:4b:1f:61:86:dd:7c:37:bb:4b:98:9e (ECDSA)
|_  256 1a:e9:72:be:8b:b1:05:d5:ef:fe:dd:80:d8:ef:c0:66 (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-title: Site doesn't have a title (text/html).
|_http-server-header: nginx/1.18.0 (Ubuntu)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   425.91 ms 10.10.16.1
2   722.33 ms keeper.htb (10.129.229.41)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep 25 04:37:39 2026 -- 1 IP address (1 host up) scanned in 44.59 seconds
```

On port 80 -> link to a subdomain:
- add it to hosts and visit the subdomain

- `tickets.keeper.htb`

Google search revealed **Request Tracker's default password**:

> `root - password` 

# User

- Admin -> Users -> Select

Select `lnorgaard` and reveal the password of the user:

> `lnorgaard - Welcome2023!`

Gained user shell

# Root

In the home directory of the user `lnorgaard` there's a zip file **RT30000.zip**.

Either unzip it on the target machine or download it for more operations:
- Anyway, we set up a python server and downloaded the zip file:

```sh
unzip RT30000.zip
```

Two files extracted from the zip:
- `KeePassDumpFull.dmp`
- `passcodes.kdbx`

> **Note**: if you can't get the **kdbx** to open in **GUI**, use the **keepass client** version: `kpcli --kdb=yourdatabase.kdb`

For the kdbx master key we can brute force, but bruteforce didn't work here.

- We found a CVE where we can gain the **master key** by exploiting the **memory dump** of the **keepass**:

> CVE-2023-32784 : https://github.com/vdohney/keepass-password-dumper/

We require **dotnet** for this (Windows or linux both work).

### Dotnet installation

> https://learn.microsoft.com/en-us/dotnet/core/install/linuxhttps://learn.microsoft.com/en-us/dotnet/core/install/linux

- Download the package for linux from above link
- Download the installation script:

```sh
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh 
```

To install latest frameworks:

```sh
./dotnet-install.sh --version latest
```

---

We can use **dotnet** either like this:

```sh
~/.dotnet/dotnet 
```

or set up the HOME variable path so we can access dotnet as `dotnet`:

```sh
export PATH="$PATH:$HOME/.dotnet"
```
---

```
dotnet run ../KeePassDumpFull.dmp
```

We faced an error: it **requires 7.0.0** runtime framework:

```sh
./dotnet-install.sh --channel 7.0 --runtime dotnet
```

Now execute **dotnet** again and we get a string of characters:

```output
Combined: ●{ø, Ï, ,, l, `, -, ', ], §, A, I, :, =, _, c, M}dgrød med fløde
```

We got most of the characters, but:
- 1st character unknown
- 2nd character one from the possibilities

`dgrød med fløde` -> Searched google:

It's the name of a Danish red berry pudding which is `rødgrød med fløde`

Gained the **master key** to the `kdbx`

There's a Putty key file of `ssh-rsa` in the **Notes** of root in the Network group.

---
> **PuTTY Key File**: Private SSH key in `.ppk` format used for password-less authentication to remote servers via PuTTY client.

> **PuTTYgen**: Utility that generates, converts, and manages PuTTY key files between formats (OpenSSH ↔ `.ppk`), with optional passphrase protection.

---
- Copy the key and save as `ssh_key_file`
- Using puttygen we can extract the private key from the file:

```sh
puttygen ssh_key_file -O private-openssh -o id_rsa-root
```

- `-O` - file type
- `-o` - Output name 

Gained `root`
