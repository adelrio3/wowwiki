# 11. Engineering Notes

Solved problems, recorded so they are never solved twice. Each entry is a problem a
future session would otherwise rediscover: a client quirk, a library gotcha, a
non-obvious reason the code is shaped the way it is. Design lives in `00` to `08`;
choices live in `09`; this file holds the "how, exactly, and why that way".

Format:

```
## N-NNNN: Short title
Area: addon | sync | ingest | db | web | helper | assets
Problem: what went wrong or what was non-obvious.
Solution: what we do, precisely, with file and function names.
Why: why this and not the obvious thing.
Verified: how we know it works (test name, probe result, date).
```

Entries are added in the same commit as the code that embodies them. An entry that no
longer matches the code is a bug in one or the other.

---

(No entries yet. The first will come from the probe results.)
