"""
Builds the Firefox package (addons.mozilla.org) from the same files as the
Chrome ZIP made by build.ps1.

The files in the repo stay untouched. Only the copies inside the Firefox
package are adjusted:
  - manifest.json: background scripts instead of a service worker, add-on id,
    minimum version, "no data collection" declaration; minimum_chrome_version
    is dropped
  - core/i18n.js: the privacy note says Firefox Sync instead of Chrome Sync
  - options.html: loads ff-permissions.js. Firefox lets users switch off the
    access to *.beekeeper.io; the settings page then shows a notice with a
    button to allow it again
  - background: ff-background.js opens the settings after install when that
    access is missing

Usage:  python build_firefox.py
Output: beeplus-for-beekeeper-v<VERSION>-firefox.zip         (upload to AMO)
        beeplus-for-beekeeper-v<VERSION>-firefox-source.zip  (source package for Mozilla's review)
"""
import io, json, os, sys, zipfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))

# Same selection as build.ps1
FILES = ['manifest.json', 'background.js', 'content.js', 'page-script.js', 'styles.css',
         'options.html', 'options.css', 'options.js',
         'README.md', 'PRIVACY.md', 'LICENSE', 'NOTICE', 'ROADMAP.md']
FOLDERS = ['icons', '_locales', 'core', 'features']

GECKO = {
    'id': 'beeplus@lupzn.de',
    # 128: content scripts in the MAIN world; 140: data collection declaration
    'strict_min_version': '140.0',
    'data_collection_permissions': {'required': ['none']},
}
HOST = 'https://*.beekeeper.io/*'

I18N_REPLACE = [
    ('settings and pinned chats sync through your Chrome profile if Chrome Sync is on.',
     'settings and pinned chats sync through your Firefox account if Firefox Sync is on.'),
    ('Einstellungen und angepinnte Chats synchronisiert Chrome über dein Profil, wenn Chrome Sync aktiv ist.',
     'Einstellungen und angepinnte Chats synchronisiert Firefox über dein Konto, wenn Firefox Sync aktiv ist.'),
]

OPTIONS_ANCHOR = '  <script src="options.js"></script>'
OPTIONS_INSERT = OPTIONS_ANCHOR + '\n  <script src="ff-permissions.js"></script>'

FF_BACKGROUND = '''// Firefox only. Users can switch off BeePlus' access to *.beekeeper.io; without
// it nothing runs on Beekeeper. Open the settings once after install so the
// notice there (ff-permissions.js) can ask for it.
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const ok = await browser.permissions.contains({ origins: ["%s"] });
  if (!ok) browser.runtime.openOptionsPage();
});
''' % HOST

FF_PERMISSIONS = '''// Firefox only: notice on the settings page when access to Beekeeper is off.
(function () {
  const ACCESS = { origins: ["%s"] };
  const TEXT = {
    en: {
      body: "BeePlus is not allowed to access Beekeeper pages, so none of its features can run. Allow access to turn them on.",
      button: "Allow access",
      done: "Access allowed. Open Beekeeper tabs are reloading."
    },
    de: {
      body: "BeePlus darf nicht auf Beekeeper-Seiten zugreifen, deshalb laufen die Funktionen nicht. Erlaube den Zugriff, um sie einzuschalten.",
      button: "Zugriff erlauben",
      done: "Zugriff erlaubt. Offene Beekeeper-Tabs werden neu geladen."
    }
  };
  const lang = () => (window.BeePlusI18n && window.BeePlusI18n.getLanguage() === "de" ? "de" : "en");

  async function refresh() {
    const ok = await browser.permissions.contains(ACCESS);
    let bar = document.getElementById("ffAccess");
    if (ok) { if (bar) bar.remove(); return; }
    if (bar) bar.remove();
    const UI = window.BeePlusUI;
    const t = TEXT[lang()];
    bar = UI.notice(t.body, { tone: "danger" });
    bar.id = "ffAccess";
    bar.classList.add("ff-access");
    bar.appendChild(UI.button(t.button, {
      variant: "primary",
      onClick: async () => {
        if (!(await browser.permissions.request(ACCESS))) return;
        const tabs = await browser.tabs.query({ url: ACCESS.origins[0] });
        for (const tab of tabs) {
          try { await browser.tabs.reload(tab.id); } catch (_) {}
        }
        UI.toast(t.done);
      }
    }));
    document.body.insertBefore(bar, document.body.firstChild);
  }

  const style = document.createElement("style");
  style.textContent = ".ff-access { align-items: center; margin: 16px; } .ff-access p { flex: 1; } .ff-access .btn { flex-shrink: 0; }";
  document.head.appendChild(style);

  browser.permissions.onAdded.addListener(refresh);
  browser.permissions.onRemoved.addListener(refresh);
  if (window.BeePlusI18n) window.BeePlusI18n.onChange(refresh);
  refresh();
})();
''' % HOST


def read(name):
    return io.open(os.path.join(HERE, name), 'rb').read()


def replace_once(name, text, old, new):
    n = text.count(old)
    if n != 1:
        sys.exit(f'{name}: expected exactly 1 occurrence of {old[:60]!r}, found {n}. Aborted, nothing built.')
    return text.replace(old, new)


def firefox_manifest(raw):
    text = raw.decode('utf-8-sig')
    nl = '\r\n' if '\r\n' in text else '\n'
    m = json.loads(text)
    m.pop('minimum_chrome_version', None)
    m['background'] = {'scripts': ['background.js', 'ff-background.js']}
    m['browser_specific_settings'] = {'gecko': GECKO}
    if HOST not in m.get('host_permissions', []):
        sys.exit('manifest.json: host_permissions no longer contains %s. Aborted.' % HOST)
    return (json.dumps(m, indent=2, ensure_ascii=False).replace('\n', nl) + nl).encode('utf-8')


def firefox_i18n(raw):
    text = raw.decode('utf-8')
    for old, new in I18N_REPLACE:
        text = replace_once('core/i18n.js', text, old, new)
    if 'Chrome' in text:
        sys.exit('core/i18n.js: still contains "Chrome". Add a replacement to I18N_REPLACE. Aborted.')
    return text.encode('utf-8')


def firefox_options(raw):
    text = raw.decode('utf-8')
    nl = '\r\n' if '\r\n' in text else '\n'
    return replace_once('options.html', text.replace('\r\n', '\n'), OPTIONS_ANCHOR, OPTIONS_INSERT).replace('\n', nl).encode('utf-8')


TRANSFORM = {
    'manifest.json': firefox_manifest,
    'core/i18n.js': firefox_i18n,
    'options.html': firefox_options,
}


def walk(folder):
    for root, _, names in os.walk(os.path.join(HERE, folder)):
        for name in sorted(names):
            full = os.path.join(root, name)
            yield full, os.path.relpath(full, HERE).replace('\\', '/')


def main():
    version = json.loads(read('manifest.json').decode('utf-8-sig'))['version']
    out = os.path.join(HERE, f'beeplus-for-beekeeper-v{version}-firefox.zip')
    src = os.path.join(HERE, f'beeplus-for-beekeeper-v{version}-firefox-source.zip')
    entries = [(f, f) for f in FILES]
    for folder in FOLDERS:
        entries.extend(walk(folder))

    for path in (out, src):
        if os.path.exists(path):
            os.remove(path)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for full, rel in entries:
            data = read(full) if not os.path.isabs(full) else io.open(full, 'rb').read()
            if rel in TRANSFORM:
                data = TRANSFORM[rel](data)
            z.writestr(rel, data)
            print('  +', rel)
        z.writestr('ff-background.js', FF_BACKGROUND.encode('utf-8'))
        z.writestr('ff-permissions.js', FF_PERMISSIONS.encode('utf-8'))
        print('  + ff-background.js\n  + ff-permissions.js')

    # Source package: the unchanged files plus this script
    with zipfile.ZipFile(src, 'w', zipfile.ZIP_DEFLATED) as z:
        for full, rel in entries:
            z.write(full if os.path.isabs(full) else os.path.join(HERE, full), rel)
        z.write(os.path.abspath(__file__), 'build_firefox.py')
        z.writestr('BUILD.txt',
                   f'How to build the Firefox package of BeePlus {version}\n'
                   '\n'
                   'Requirements: Python 3.8 or later. Only the standard library is used,\n'
                   'no other tools, no network access. Works on Windows, macOS and Linux.\n'
                   '\n'
                   '1. Unzip this source package into an empty folder.\n'
                   '2. In that folder run:  python build_firefox.py\n'
                   f'3. Result: beeplus-for-beekeeper-v{version}-firefox.zip\n'
                   '   (the script also writes a new source package next to it).\n'
                   '\n'
                   'The files in the result are the files of this package, unchanged, except:\n'
                   '- manifest.json: background scripts instead of a service worker, gecko id,\n'
                   '  strict_min_version, data_collection_permissions; minimum_chrome_version removed\n'
                   '- core/i18n.js: one sentence says "Firefox Sync" instead of "Chrome Sync"\n'
                   '- options.html: one extra <script> tag for ff-permissions.js\n'
                   '- added: ff-background.js and ff-permissions.js (their full text is in build_firefox.py)\n'
                   '\n'
                   'No minification, bundling, transpiling or templating.\n')

    print(f'\nBuilt:  {os.path.basename(out)} ({os.path.getsize(out) // 1024} KB)')
    print(f'Source: {os.path.basename(src)} ({os.path.getsize(src) // 1024} KB)')


if __name__ == '__main__':
    main()
