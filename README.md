# EFI Boot Switcher

A GNOME Shell 46 top-bar menu that lists your UEFI boot entries and reboots into the one you pick, once. Use it to get to Windows (or any other entry) without opening the firmware boot menu.

## Compatibility

Requires **GNOME Shell 46** on a UEFI system with `efibootmgr` installed (for example `sudo apt install efibootmgr` on Debian and Ubuntu). If it is missing, the menu shows an `efibootmgr` error instead of the entries. Other GNOME Shell versions are not currently supported.

In GNOME's Extensions app, it appears as **EFI Boot Switcher**. Its extension ID is `efi-boot-switcher@mylesshannon.github.io`, which is used in the commands below.

## Use

1. Click the reboot icon in the top bar. The menu lists every active boot entry, and marks the one you're running.
2. Pick an entry. A dialog asks you to confirm.
3. Click **Reboot**, or press Enter. The computer restarts into that entry.

Only the next boot changes. The extension sets the firmware's one-time `BootNext` variable, which the firmware clears after using it, so the following restart uses your normal boot order again. Your boot order is never changed.

Some major Windows updates move Windows Boot Manager to the front of the boot order. If you start landing in Windows unexpectedly, run `efibootmgr` to check the order, then `sudo efibootmgr --bootorder XXXX,YYYY` to put your Linux entry first.

## Install

Clone the repository:

```sh
git clone https://github.com/MylesShannon/efi-boot-switcher.git
cd efi-boot-switcher
```

Setting `BootNext` needs root, so a small helper, `efi-bootnext`, does just that. It accepts only a four-digit hex ID that matches an active boot entry. Install it, and let your user run it without a password:

```sh
sudo install -m 755 -o root -g root efi-bootnext /usr/local/sbin/efi-bootnext
echo "$USER ALL=(root) NOPASSWD: /usr/local/sbin/efi-bootnext *" | sudo tee /etc/sudoers.d/efi-bootnext
sudo chmod 440 /etc/sudoers.d/efi-bootnext
sudo visudo -c
```

This means any program running as your user can choose the next boot entry without a password. It can't change the boot order, and the logged-in user can usually reboot without a password anyway.

Then build and install the extension:

```sh
mkdir -p dist
gnome-extensions pack --force --out-dir=dist .
gnome-extensions install --force dist/efi-boot-switcher@mylesshannon.github.io.shell-extension.zip
```

Log out and back in so GNOME finds the extension, then enable it:

```sh
gnome-extensions enable efi-boot-switcher@mylesshannon.github.io
```

GNOME also needs a logout and login to load updated JavaScript.

## Remove

```sh
gnome-extensions disable efi-boot-switcher@mylesshannon.github.io
gnome-extensions uninstall efi-boot-switcher@mylesshannon.github.io
sudo rm /etc/sudoers.d/efi-bootnext /usr/local/sbin/efi-bootnext
```

## Development

No downloaded dependencies are needed. GNOME supplies GJS and the UI APIs.

```sh
sh -n efi-bootnext
node --check extension.js
mkdir -p dist
gnome-extensions pack --force --out-dir=dist .
```

`extension.js` owns the top-bar menu, the confirm dialog, and calling the helper through `sudo -n`. `efi-bootnext` is the only code that runs as root: it validates the ID against the active entries from `efibootmgr` and then sets `BootNext`.

## License

MIT, see [LICENSE](LICENSE) and [NOTICE](NOTICE). This is a personal project and isn't connected to any employer.
