---
title: LazyCat
date: 2025-10-25
tags:
  - linux
  - bash
  - nmap
---

We've all been there. It's 1 AM, you're deep into a Hack The Box machine, and you've just kicked off your initial recon. You run `nmap -p- <IP>` to find all open ports... and you wait.

Then, the scan finishes. You squint at the output, manually copy-pasting the 3 or 4 open ports into a *new* command: `nmap -sC -sV -A -p 22,80,445 <IP>`... and you wait again.

This manual step of grabbing ports, re-typing commands, and wasting precious minutes was driving me crazy. It's a small thing, but it breaks your flow. It was born out of pure frustration during those late-night sessions. I wanted to stop wasting time on repetitive scanning and focus on what actually matters—getting root.

So, I built **LazyCat**.

## What is LazyCat?

LazyCat is a super simple Bash script that automates my personal Nmap workflow. It's not a complex framework; it's a "fire and forget" tool designed to do one thing well: **get you the detailed scan results you need, fast.**

It's built to be the first thing you run against a new box.

## How It Works

The logic is simple, but it saves a ton of time. When you run `lazycat <IP_ADDRESS>`, here's what happens under the hood:

1.  **Phase 1: Fast TCP Port Scan**
    It first runs a very fast, all-ports scan (`nmap -p- --min-rate=5000`) and saves the output to a temporary file. This just hunts for *any* open TCP port.

2.  **Phase 2: Automated Port Extraction**
    This is the key. The script immediately parses that temp file, extracts *only* the open port numbers, and formats them into a comma-separated list (e.g., `21,22,80,445`).

3.  **Phase 3: Detailed TCP Scan**
    It instantly feeds that port list into a new, detailed Nmap scan (`nmap -p<ports> -A`). This runs service version detection, script scanning, OS detection, and traceroute *only* on the ports we know are open. This detailed output is saved to `scan_results.txt`.

4.  **Phase 4: Quick UDP Scan**
    Finally, it runs a quick, separate UDP scan (`nmap -sU -sV -F -open`) to catch common low-hanging fruit like SNMP or TFTP, saving the results to `udp_scan_results.txt`.

That's it. You run one command, grab a coffee, and come back to two clean-text files with all your initial recon done.

## Why Your Life Just Got Better

-   **No More Manual Work:** It completely eliminates that annoying manual port extraction step.
-   **Consistent Scans:** Ensures you run the same, thorough scanning methodology every single time.
-   **Saves Time:** You're not waiting to interact with the terminal; you're running the detailed scan the *second* the first port is found.
-   **Full Coverage:** You get both a deep-dive on TCP and a quick check on UDP without thinking about it.

## Get It Now (Installation)

Installation is a 3-line copy-paste job.

```bash
# Download the script
curl -L https://raw.githubusercontent.com/Alx-J/lazyc4t/main/lazycat.sh -o lazycat

# Make it executable
chmod +x lazycat

# Move it to your path so you can call it from anywhere
sudo mv lazycat /usr/local/bin/
```
