# WoW Compendium Probe

A throwaway diagnostic add-on. It records which API functions and events this game
client exposes, plus a handful of samples of real event data, into a SavedVariables
file. It has no interface beyond a one-line login message and the `/cprobe` command.
Nothing it records leaves your computer; you send the file to us by hand.

## Install

1. Download this folder (`WoWCompendiumProbe`) as a zip from GitHub and extract it.
2. Copy the `WoWCompendiumProbe` folder into
   `World of Warcraft\_classic_era_\Interface\AddOns\`.
   For the Anniversary client, use `_anniversary_\Interface\AddOns\` instead.
   The result should be `...\Interface\AddOns\WoWCompendiumProbe\Probe.lua`.
3. Launch the game. On the character select screen, click **AddOns** and tick
   **Load out of date AddOns** if the probe shows as out of date.
4. Log in. You should see "WoW Compendium Probe loaded." in chat.

## Use

Play normally for twenty to thirty minutes and try to do each of these at least once:

- Target and mouse over several creatures and NPCs, including one elite if convenient.
- Talk to a quest giver: accept a quest, turn one in, and open a quest you cannot
  complete yet (to see the "progress" text).
- Open a vendor, a class or profession trainer, and a flight master's map.
- Open your profession window (and enchanting, if you have it).
- Loot a few corpses, and if possible one chest, herb, mineral vein, or fishing catch.
- Read any book, sign, or plaque in the world.
- Stand near an NPC that talks or yells.
- Change zones at least once.
- If it happens, dying is also useful data.

Then type `/reload` (or log out). That writes the file.

## Send

The file is at
`World of Warcraft\_classic_era_\WTF\Account\<YOUR ACCOUNT>\SavedVariables\WoWCompendiumProbe.lua`.
Send that file. It contains your character name, realm, and the names of things you
interacted with, and nothing else personal. It does not contain your account name,
email, BattleTag, or chat.

Repeat on the Anniversary client if you have a character there; the same folder layout
applies under `_anniversary_`.

## Remove

Delete the `WoWCompendiumProbe` folder from `Interface\AddOns`. Optionally delete the
SavedVariables file named above.
