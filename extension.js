import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const HELPER = '/usr/local/sbin/efi-bootnext';

function run(argv) {
    return new Promise((resolve, reject) => {
        const proc = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, out] = p.communicate_utf8_finish(res);
                if (p.get_successful())
                    resolve(out);
                else
                    reject(new Error(out.trim() || 'command failed'));
            } catch (e) {
                reject(e);
            }
        });
    });
}

function parseEntries(out) {
    const current = /^BootCurrent: (\w{4})/m.exec(out)?.[1];
    const entries = [];
    for (const m of out.matchAll(/^Boot(\w{4})\* ([^\t\n]+)/gm))
        entries.push({id: m[1], name: m[2], current: m[1] === current});
    return entries;
}

export default class EfiBootSwitcher extends Extension {
    enable() {
        this._button = new PanelMenu.Button(0.5, 'EFI Boot Switcher');
        this._button.add_child(new St.Icon({
            icon_name: 'system-reboot-symbolic',
            style_class: 'system-status-icon',
        }));
        this._button.menu.addMenuItem(new PopupMenu.PopupMenuItem('Loading…', {reactive: false}));
        this._openId = this._button.menu.connect('open-state-changed',
            (_menu, open) => open && this._refresh());
        Main.panel.addToStatusArea(this.uuid, this._button, 0, 'right');
    }

    disable() {
        this._button?.menu.disconnect(this._openId);
        this._button?.destroy();
        this._button = null;
    }

    async _refresh() {
        const menu = this._button.menu;
        menu.removeAll();
        menu.addMenuItem(new PopupMenu.PopupMenuItem('Reboot into…', {reactive: false}));
        try {
            for (const entry of parseEntries(await run(['efibootmgr']))) {
                const item = new PopupMenu.PopupMenuItem(
                    entry.current ? `${entry.name} (running)` : entry.name);
                item.connect('activate', () => this._confirm(entry));
                menu.addMenuItem(item);
            }
        } catch (e) {
            menu.addMenuItem(new PopupMenu.PopupMenuItem(`efibootmgr: ${e.message}`,
                {reactive: false}));
        }
    }

    _confirm(entry) {
        const dialog = new ModalDialog.ModalDialog({destroyOnClose: true});
        dialog.contentLayout.add_child(new St.Label({
            text: `Reboot now into ${entry.name}?\nOnly the next boot changes.`,
            x_align: Clutter.ActorAlign.CENTER,
        }));
        dialog.addButton({label: 'Cancel', action: () => dialog.close(), key: Clutter.KEY_Escape});
        dialog.addButton({
            label: 'Reboot',
            default: true,
            action: async () => {
                dialog.close();
                try {
                    await run(['sudo', '-n', HELPER, entry.id]);
                    await run(['systemctl', 'reboot']);
                } catch (e) {
                    Main.notifyError('EFI Boot Switcher', e.message);
                }
            },
        });
        dialog.open();
    }
}
