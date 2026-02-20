---
title: Sightless
date: 2025-01-26
draft: false
tags:
  - htb
  - easy
  - linux
---
# Initial Recon
we found three ports 
```
21 → ftp (which kick us out)
22 → ssh 
80 → http
```

## subdomain enum

```
ffuf -c -u http://sightless.htb/ -H "HOST: FUZZ.sightless.htb" -w /path/to/your/preferred/wordlist 
```
 → for subdomain enumeration we used two wordlist they both might work 
 
→ /usr/share/seclists/Discovery/DNS/dns-Jhaddix.txt
 
→/usr/share/seclists/Discovery/DNS/n0kovo_subdomains.txt

 but the wordlist is too big so we filtered based on first letter it using grep 

we know it show's they gave a service sqlpad so out of guess we used `s` 

```
grep -i '^s' wordlist.txt > filtered_wordlist.txt
```

```
ffuf -c -u  http://sightless.htb/ -H "HOST: FUZZ.sightless.htb" -w /path/to/your/preferred/wordlist -fc 301
```

we used it and we got 200 status for sqlpad which is the subdomain 

note: we need to add the subdomain(sqlpad.sightless.htb) to the /etc/hosts file with same ip(10.10.11.32) for sightless.htb

http://sqlpad.sightless.htb

 → search it on browser now check the version of the sqlpad console `sqlpad 6.10.0`
 
 we checked on google and we got an CVE 
https://github.com/0xDTC/SQLPad-6.10.0-Exploit-CVE-2022-0944

# User 
download that CVE (check the readme.md before for how to use it)

we got the root access but the host name is something random instead of sightless.htb which we targeting and we checked /etc/hosts → the ip starts with 172.x.x.x which may be docker 

`sqlpad.sqlite`  ⇒ we got users on this file 
```
john@sightless.htb   
admin@sightless.htb
```

we know that we are a root so we can access anything and there another user who may be created this docker environment which is **michael** 

cat /etc/shadow ⇒ we got hash for michael from this 
```
$6$mG3Cp2VPGY.FDE8u$KVWVIHzqTzhOSYkzJIpFc2EsgmqvPa.q2Z9bLUU6tlBWaEwuxCDEP9UFHIXNUcF2rBnsaFYuJa6DUh/pL2IJD/  → insaneclownposse 
```
login through ssh and we got into the target host

we need to check that we not into another docker again by → /etc/hosts 

⇒ and we found out another subdomain→ `admin.sightless.htb`

→ to check what it was
```
curl admin.sightless.htb 
```
→ because maybe michael got permission to access that subdomain
⇒ we got 302 which is a temporary redirecting error

```
curl -H ‘Host: admin.sightless.htb’ http://127.0.0.1 
```

→  it's not working if we check through `netstat -antp` we can see there are lot of service listening but there is a http port that peaked our interest which listening on local host 
```
127.0.0.1:8080          0.0.0.0:*               LISTEN
```

```
curl  -H ‘Host: admin.sightless.htb’ http://127.0.0.1:8080
```

→ or we can ssh port forwarding(tunneling) instead of that (but we did port forwarding using ssh ) 
⇒ target localhost :8080 to 8080 on our localhost 
→ if we did that we can just curl our localhost with forwarded port  to access it
⇒ and we need to set /etc/hosts 
→ `127.0.0.1      admin.sightless.htb`

⇒ so we can access a login page on http://127.0.0.1:8888/ on our browser and it got the login page of `froxlor`

so we verified it runs `froxlor app`

⇒ due to we don't have either user or password for this we need to hold on 
→ now we need to download and execute `pspy64` on michael user
we found 
⇒ it has `--remote-debugging` flag used with chrome, suggesting chrome remote debugging `/home/john/automation/chromedriver --port=40287`
→ we know at what port the chromium developer tools available 
(the port will change once in few minutes to check it not )

⇒ forward the `chromedriver`(chrome debugger) port 40287 to our local machine using ssh 
⇒ now we need to find endpoints of http://sightless.htb:40287/  using `feroxbuster`
⇒ `\sessions` seems interesting 
⇒ we got debugger address on that which is `localhost:33385`

⇒ we need to port forward this too (it has the tools needed by chrome debugger)

(we used this the other day because we closed all port forwarding and to redo the port forwarding)									

# Root

NOTE:
→  we just did ssh port forwarding(tunneling)
```
ssh -L 8080:127.0.0.1:8080 -L 40287:127.0.0.1:40287 -L 33385:127.0.0.1:33385 michael@sightless.htb
```

→ visit chrome://inspect/#devices on chromium 
→ select configure
→ add 127.0.0.1:40297 and Done (it is the chrome debugger(chromedriver) port we found on pspy64 or ps aux | grep chromedriver)
→ on remote target tab we get a connection
→ inspect it  
→ it open a new tab → right click on the column → add method
→ find post method → double click on the file → select payload tab you got user&password 
`admin : ForlorfroxAdmin`

→ now we can login on the login panel, we found out →  `froxlor version 2.1.8` 

we search for exploit on internet and we got blind XSS exploit but it didn't work for us 
https://github.com/froxlor/Froxlor/security/advisories/GHSA-x525-54hf-xr53

so we just check on the dashboard there is 1 customer so we moved to the customer tab which found under resources tab on side pannel 

→ we found a user called john with username web1 
→ click on the username and it provided us with another dashboard 
→ but on the side pannel there is ftp → accounts 
→ we are the admin so we can change the user's password


→ we used suggested password and saved it 

now we just focus to the ftp port that we found during the nmap scan at start it stills kicks us out with error again when we entered legitimate creds

```
error :550 SSL/TLS required on the control channel
```

so we need ftp client that can do SSL 
→ we used lftp for this 
→ `lftp`→ `set ftp:ssl-allow true`

```
error: ls: Fatal error: Certificate verification: The certificate is NOT trusted. The certificate issuer is unknown. 
```

→ `set ssl:verify-certificate false`
→ `lftp -u web1 sightless.htb`
→ now moving around the directories is helped us to find a file called `Database.kbd`

→ we used 
```
keepass2john Database.kdb > dbhash.txt
```

→ we cracked it using 
```
john --wordlist=/usr/share/wordlist/rockyou.txt dbhash.txt 
```

→ `bulldogs` (master password)

→ `keepassxc Database.kdb` due to the file is keepass version 1, we need to use import option on the displayed window of keepassxc 

→ and we extract it and save it as a file 
→ opening the extracted password.kdbx file and we got root password(which don't work).
→  if we go to the advanced tab on below we got the id_rsa key

Gained `Root`