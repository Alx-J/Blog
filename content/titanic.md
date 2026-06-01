---
title: Titanic
date: 2025-03-01
description: Exploited an arbitrary file read vulnerability in the Titanic booking application to extract Gitea data, crack PBKDF2 credentials for SSH access, and escalate privileges through a vulnerable ImageMagick installation (CVE-2024-41817) to gain root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

Performed an Nmap scan:

```bash
nmap -sC -sV <TARGET-IP>

22/tcp open  ssh   OpenSSH 8.9p1 Ubuntu 3ubuntu0.10
80/tcp open  http  Apache httpd 2.x
```

Port `80` redirected to:

```text
http://titanic.htb/
```

The application exposed an interesting endpoint:

```text
/book
```

After submitting the booking form, the application returned a downloadable JSON file.

Intercepting the request with Burp revealed a redirect to:

```text
/download?ticket=<random-id>.json
```

# User

## Local File Inclusion (LFI)

Modifying the `ticket` parameter in Burp Repeater exposed an arbitrary file read vulnerability.

By replacing the generated filename with system paths, file disclosure was confirmed.

Initially attempted to retrieve SSH keys from the `developer` account, but that path led nowhere.

Enumerating `/etc/hosts` through the LFI exposed an additional virtual host:

```text
dev.titanic.htb
```

The same vulnerability could also be used to retrieve `user.txt` directly.

## Gitea Enumeration

Browsing to:

```text
http://dev.titanic.htb
```

revealed a Gitea instance.

A new account could be registered, allowing access to public repositories.

Two repositories stood out:

- **docker-config**
- **flask-app**

Reviewing **flask-app** confirmed the vulnerable file handling logic responsible for the LFI.

Inspecting **docker-config** revealed that Gitea was running inside Docker and storing data under:

```text
/home/developer/gitea/data
```

## Extracting the Gitea Database

Gitea documentation indicates that user data is stored inside:

```text
/data/gitea/gitea.db
```

Using the LFI along with Burp's **Show Response in Browser** feature allowed the database to be downloaded.

After opening the SQLite database, the `user` table exposed account information, including password hashes and salts.

## Cracking the Credentials

A quick Python script was used to reproduce the PBKDF2 hash and test candidates from `rockyou.txt`.

```python
import hashlib
import binascii

def pbkdf2_hash(password, salt, iterations=50000, dklen=50):
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        iterations,
        dklen
    )

def find_matching_password(dictionary_file, target_hash, salt, iterations=50000, dklen=50):
    target_hash_bytes = binascii.unhexlify(target_hash)

    with open(dictionary_file, 'r', encoding='utf-8') as file:
        for password in file:
            password = password.strip()

            if pbkdf2_hash(password, salt, iterations, dklen) == target_hash_bytes:
                print(f"Found password: {password}")
                return password

salt = binascii.unhexlify('8bf3e3452b78544f8bee9400d6936d34')
target_hash = 'e531d398946137baea70ed6a680a54385ecff131309c0bd8f225f284406b7cbc8efc5dbef30bf1682619263444ea594cfb56'

find_matching_password(
    '/usr/share/wordlists/rockyou.txt',
    target_hash,
    salt
)
```

The hash was successfully cracked, revealing the `developer` account password.

### Alternative Method

Converted the hash into Hashcat format using:

```bash
gitea2hashcat.py
```

Then crack it with:

```bash
hashcat -m 10900 gitea_hash.txt rockyou.txt
```

Captured access through SSH:

```bash
ssh developer@titanic.htb
```

# Root 

```bash
sudo -l
```

showed no direct sudo privileges.

## ImageMagick Abuse

While enumerating the filesystem, a script was discovered under:

```text
/opt/scripts
```

The file:

```text
identify_images.sh
```

used ImageMagick's `identify` utility to process uploaded images.

Checking the installed version revealed:

```text
ImageMagick 7.1.1-35
```

This version is vulnerable to **CVE-2024-41817**, allowing arbitrary code execution when processing crafted image files.

A malicious `.mvg` or `.svg` payload could trigger command execution once processed by `identify`.

A shared-library payload was compiled and leveraged for execution. A reverse shell payload works just as well if you prefer a louder entrance.

Leveraged the vulnerable ImageMagick workflow to execute commands as `root` and complete the compromise.

Gained `root`