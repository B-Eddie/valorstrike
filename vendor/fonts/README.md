# HUD fonts (SIL Open Font License 1.1)

- `Oswald-subset.woff2`: Oswald variable (wght 200-700), https://github.com/google/fonts/tree/main/ofl/oswald, licence `OFL-Oswald.txt`.
- `BebasNeue-subset.woff2`: Bebas Neue Regular, https://github.com/google/fonts/tree/main/ofl/bebasneue, licence `OFL-BebasNeue.txt`.

Both are subset to Latin-1 + common punctuation (`pyftsubset --unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+00B7,U+2026 --flavor=woff2`)
and embedded as base64 data URIs in the `<style id="xHudV2">` block of `index.html` ("VS Hud" = Oswald for HUD numbers and labels,
"VS Title" = Bebas Neue for portrait initials and banners), so the page loads no font over the network. These files are the
source of those data URIs.
