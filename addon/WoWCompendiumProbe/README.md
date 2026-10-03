# WoW Compendium Probe

A throwaway diagnostic add-on. It records which API functions and events this game
client exposes, plus small samples of real event data, into a SavedVariables file. It
has no interface beyond a one-line login message and the `/cprobe` command. Nothing it
records leaves your computer; you send the file by hand.

Version 2 replaces version 1 and clears version 1 data on first login.

## Install

1. Extract the zip so you have a folder named `WoWCompendiumProbe`.
2. Copy that folder into `World of Warcraft\_classic_era_\Interface\AddOns\`,
   replacing the old one. The result should be
   `...\Interface\AddOns\WoWCompendiumProbe\Probe.lua`.
   For the Anniversary client, use `_anniversary_\Interface\AddOns\` instead.
3. Launch the game. On the character select screen, click **AddOns** and tick
   **Load out of date AddOns** if needed.
4. Log in. You should see "WoW Compendium Probe loaded." in chat.

## What to do in game (version 2, short run)

- Target an NPC and a creature, and mouse over a few more.
- Mouse over a chest, herb, mineral vein, mailbox, or sign (no unit, just the object).
- Open a trainer and wait two seconds before closing.
- Open a flight master's map.
- Loot a corpse. If possible, open a chest, pick an herb, or catch a fish.
- Read a sign, plaque, or book.
- Stand near an NPC that talks or yells (not only emotes).
- Walk into a subzone you have never visited, if one is nearby.
- Change zones once.

Then type `/reload`.

`/cprobe tip` with a target prints what the hidden tooltip scan sees, if you are curious.

## Send

`World of Warcraft\_classic_era_\WTF\Account\<YOUR ACCOUNT>\SavedVariables\WoWCompendiumProbe.lua`

## Remove

Delete the `WoWCompendiumProbe` folder from `Interface\AddOns` when we are done with it.
