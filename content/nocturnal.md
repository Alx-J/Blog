---
title: Nocturnal
date: 2025-07-10
description: Exploited an IDOR vulnerability to access user files and recover credentials, leveraged command injection in the backup functionality for initial access, pivoted through cracked database hashes to SSH as tobias, and escalated to root through ISPConfig CVE-2023-46818.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

Identified SSH and HTTP services exposed on the target. Directory enumeration revealed login, registration, uploads, and backup-related functionality.

## Foothold

After registering a user and testing the upload feature, it became clear that uploaded files could be accessed through a predictable URL structure.

Leveraging an **IDOR** vulnerability in the file viewer allowed enumeration of valid users. Response length analysis with Burp Suite Intruder identified **amanda** as a user with accessible files.

Downloaded `privacy.odt`, extracted its contents, and searched for sensitive data:

`grep -ir "password" privacy/*`

Recovered credentials:

`amanda : arHkG7HAI68X8s1J`

## Admin Panel Enumeration

Authenticated as **amanda** and reviewed the administrative interface.

The panel exposed application source code and a backup feature. Reviewing the source revealed database interaction and backup functionality that accepted user-controlled input.

## Command Injection

Intercepted the backup request with Burp Suite and identified a command injection vulnerability.

Special characters such as `\n`, `\r`, and `\t` were used to break out of the intended command context and execute arbitrary commands.

The vulnerability was leveraged to dump the SQLite database:

`sqlite3 /var/www/nocturnal_database/nocturnal_database.db`

Extracted password hashes and cracked them using CrackStation, recovering credentials for **tobias**.

Captured access as **tobias**.

# Root

## Lateral Movement

Local enumeration revealed an internal service listening on port `8080`.

Using SSH port forwarding exposed the service locally. Authentication succeeded through password reuse, providing access to an ISPConfig administrative interface.

Version identification confirmed:

`ISPConfig 3.2`

## Privilege Escalation

Research identified **CVE-2023-46818**, a code execution vulnerability affecting ISPConfig.

The exploit was used to obtain PHP code execution and a limited web shell.

Generated an SSH key pair and wrote the public key into root's `authorized_keys` file through the available command execution primitive.

Gained `Root`