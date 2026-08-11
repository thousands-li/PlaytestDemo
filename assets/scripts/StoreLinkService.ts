export interface StoreLinkConfig {
    iosStoreUrl: string;
    androidStoreUrl: string;
}

export class StoreLinkService {
    public constructor(private readonly getConfig: () => StoreLinkConfig) {}

    public open() {
        const config = this.getConfig();
        const ua = navigator.userAgent || '';
        const url = /Android/i.test(ua) ? config.androidStoreUrl : config.iosStoreUrl;
        const win = window as Window & { mraid?: { open: (url: string) => void } };
        if (win.mraid && typeof win.mraid.open === 'function') {
            win.mraid.open(url);
            return;
        }
        window.open(url, '_blank');
    }
}
