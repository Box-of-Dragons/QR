/* footer-links.js - single source of truth for the QR page footer links.
 *
 * Sets window.SITE_FOOTER for the shared site-footer.js renderer (loaded
 * from the root Structured Chaos site). Include this file before the
 * site-footer.js loader on every page:
 *
 *   <script src="/js/footer-links.js"></script>
 *
 * To add or rename a page, edit the links array below — every page picks
 * it up on next load.
 */
window.SITE_FOOTER = {
    label: 'QR',
    buildInfoSrc: '/js/buildInfo.js',
    links: [
        { label: 'Home', href: '/' },
        { separator: true },
        { label: '418 Teapot', href: '/418' },
        { label: 'Device Manual', href: '/manual' },
        { label: 'Scan', href: '/scan' },
        { label: 'Security Check', href: '/secure' },
        { label: 'Support', href: '/support' },
        { label: 'Wi-Fi', href: '/wifi' },
        { separator: true },
        { label: 'Text Generator', href: '/text-generator' },
        { label: 'QR Generator', href: '/generator' }
    ]
};
