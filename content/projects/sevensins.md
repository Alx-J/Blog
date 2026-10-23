---
title: SevenSins
description: It chains multiple stages of web and infrastructure exploitation into a single continuous attack path, keeping your engagement moving from foothold to root without a dead end.
tags:
  - linux
  - web
  - chain-exploit
status: live
repo: https://tinyurl.com/Seven5ins
date: 2026-08-25
---
# SevenSins

A deliberately vulnerable e-commerce web application, built as a multi-stage CTF machine for anyone who wants to practice real-world web and infrastructure exploitation from the ground up.

## Project Overview

SEVENSINS is a custom-built vulnerable machine themed around the seven deadly sins: seven flags, each tied thematically to a sin and functionally to a distinct stage of compromise. It's a full attack-chain exercise, not a one-hit wonder. You don't pop one vulnerability, take a bow, and call it a day. You start with a foothold on a public-facing web app and have to pivot, enumerate, and escalate across multiple services to reach the end.

It's built to feel like a small slice of a real target: a web app with a genuine bug, an admin panel that isn't as locked down as it should be, internal services that trust each other a little too much, and a privilege escalation path at the end of it all.

## About the Machine

The target is a PHP/Apache/MySQL e-commerce application with an admin panel driven by Node.js and a browser-automation "admin bot," meaning some of what you do as an attacker has to actually be _seen_ by something resembling a real user, not just queried directly. Beyond the web layer, the box exposes additional services typical of a small internal environment, and progress depends on carrying what you learn from one service into the next.

Each of the seven flags marks a milestone along the chain, moving from initial web application compromise through to full system control.

## What You'll Learn

Attempting SEVENSINS will give you hands-on practice with:

- Identifying and weaponizing client-side vulnerabilities in a realistic web application, including thinking from _another user's_ browser and session, not just your own
- Web application testing through manual analysis of inputs and behavior, not just automated scanning
- Database enumeration and exploitation once a foothold is established
- Credential handling: recognizing hash formats, cracking them efficiently, and pivoting across services on reused credentials
- Reading between the lines of configuration files, logs, and leftover artifacts that real systems often contain
- Pulling useful clues out of compiled binaries without needing to fully reverse the whole thing
- Identifying and abusing a misconfigured privilege escalation vector

## Who Is This Machine For?

SEVENSINS is aimed at:

- CTF players comfortable with the basics of web exploitation who want a longer, chained scenario
- Penetration testers looking to practice an end-to-end engagement flow in a safe, self-contained environment
- Students and self-learners moving past single-vulnerability exercises toward realistic, multi-step compromises
- Anyone who enjoys a machine that tells a small story through its flags rather than just being a checklist

Some prior exposure to common web vulnerabilities and basic Linux usage will make the early stages smoother, but the machine is built to teach along the way. You don't need to already know every technique before you start.

## What Makes It Fun?

SEVENSINS isn't a single isolated bug, it's a chain. Every flag hands you something you'll actually need for the next one: a credential, a username, a service you didn't know was reachable. Nothing here is wasted or purely decorative, and nothing is going to politely wait for you to notice it. You have to go looking. The admin-bot element also means thinking about your exploitation from someone else's point of view, a different muscle than attacking a server directly. By the end, you'll have touched a genuine spread of attacker tradecraft, all tied together under one theme and building to one last satisfying finish.

## Prerequisites and Recommended Knowledge

- Comfort with a Linux attacker environment (Kali or similar)
- Familiarity with common web vulnerability classes
- Basic understanding of hash cracking tools and workflows
- Experience connecting to and enumerating common network services

## How to Get Started

1. Deploy the machine in your lab environment.
2. Start with standard reconnaissance against the web application. Don't rush past it, no matter how tempting that is.
3. Pay attention to _how_ the application responds to your input, not just _whether_ it responds. The details are where the real fight is.
4. Keep track of every piece of information you gather, even if it isn't immediately useful. It will be.
5. Work the chain one flag at a time.