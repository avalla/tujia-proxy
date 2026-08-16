import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface ScraperOptions {
  cityId: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  headless: boolean;
  outputDir: string;
  storageState?: string; // path to saved login session
}

export interface ScrapedHotel {
  id: string;
  name: string;
  nameOriginal: string;
  pricePerNightCNY: number;
  pricePerNightEUR: number;
  rating: number;
  reviewCount: number;
  image: string;
  district: string;
  tags: string[];
  raw: any;
}

const CNY_TO_EUR = 0.13;
const STORAGE_PATH = './storage/tujia-state.json';

export class TujiaScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: ScraperOptions;
  private apiResponses: any[] = [];

  constructor(options: Partial<ScraperOptions> = {}) {
    this.options = {
      cityId: options.cityId || '45',
      cityName: options.cityName || '广州',
      checkIn: options.checkIn || '2026-10-10',
      checkOut: options.checkOut || '2026-11-05',
      guestCount: options.guestCount || 1,
      headless: options.headless !== false,
      outputDir: options.outputDir || './output',
      storageState: options.storageState || STORAGE_PATH,
    };
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const contextOptions: any = {
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    };

    // Load saved session if exists
    if (fs.existsSync(this.options.storageState!)) {
      console.log('[*] Loading saved session...');
      contextOptions.storageState = this.options.storageState;
    }

    this.context = await this.browser.newContext(contextOptions);

    // Block unnecessary resources
    await this.context.route(/\.(png|jpg|jpeg|gif|svg|css|woff|woff2)$/, (route) =>
      route.abort()
    );

    this.page = await this.context.newPage();

    // Intercept API responses
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('searchhouse/bnb') && response.status() === 200) {
        try {
          const data = await response.json();
          if (data.errcode && data.errcode !== 0) {
            console.log('[!] API error:', data.errmsg);
            return;
          }
          this.apiResponses.push({ url, data, timestamp: Date.now() });
          console.log('[+] API intercepted:', url.split('?')[0]);
        } catch {
          // ignore non-JSON
        }
      }
    });

    console.log('[*] Browser initialized');
  }

  async handleLoginIfNeeded(): Promise<void> {
    if (!this.page) return;

    // Check if we're on a login page or got login error
    const currentUrl = this.page.url();
    const bodyText = await this.page.locator('body').innerText().catch(() => '');

    const isLoginRequired =
      bodyText.includes('登录') ||
      bodyText.includes('请重新登录') ||
      bodyText.includes('55004') ||
      currentUrl.includes('login');

    if (!isLoginRequired) {
      console.log('[*] No login required');
      return;
    }

    console.log('[!] Login required. Opening browser for manual login...');
    console.log('[!] Please log in with your Tujia/WeChat/phone account');
    console.log('[!] The session will be saved automatically after login');

    // Open login page
    await this.page.goto('https://m.tujia.com/login', { waitUntil: 'domcontentloaded' });

    // Wait for login to complete (detect redirect away from login page)
    await this.page.waitForFunction(
      () => !window.location.href.includes('login'),
      { timeout: 300000 } // 5 minutes for manual login
    );

    console.log('[+] Login detected! Saving session...');

    // Save storage state
    const storageDir = path.dirname(this.options.storageState!);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    await this.context!.storageState({ path: this.options.storageState });
    console.log('[+] Session saved to', this.options.storageState);
  }

  async navigateToSearch(): Promise<void> {
    if (!this.page) throw new Error('Not initialized');

    const url = `https://m.tujia.com/hotel_city${this.options.cityId}/`;
    console.log(`[*] Navigating to ${url}`);

    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle login if needed
    await this.handleLoginIfNeeded();

    // Set date cookies
    await this.context!.addCookies([
      {
        name: 'tujia.com_MobileContext_StartDate',
        value: this.options.checkIn,
        domain: '.tujia.com',
        path: '/',
      },
      {
        name: 'tujia.com_MobileContext_EndDate',
        value: this.options.checkOut,
        domain: '.tujia.com',
        path: '/',
      },
    ]);

    await this.page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for content
    try {
      await this.page.waitForSelector('.unit-list, .search-btn, [class*="list"], [class*="unit"]', {
        timeout: 15000,
      });
    } catch {
      console.log('[!] List selector not found, waiting for API...');
    }

    console.log('[*] Page loaded, waiting for API data...');
    await this.page.waitForTimeout(5000);
  }

  async scrollToLoadMore(maxScrolls: number = 5): Promise<void> {
    if (!this.page) return;

    for (let i = 0; i < maxScrolls; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 800));
      await this.page.waitForTimeout(2000);

      const before = this.apiResponses.length;
      await this.page.waitForTimeout(1000);
      if (this.apiResponses.length === before) {
        console.log('[*] No more content loading');
        break;
      }
      console.log(`[*] Scroll ${i + 1}/${maxScrolls}`);
    }
  }

  extractHotels(): ScrapedHotel[] {
    const hotels: ScrapedHotel[] = [];
    const seen = new Set<string>();

    for (const resp of this.apiResponses) {
      // searchhouse/bnb returns its units in data.items.
      const list = resp.data?.data?.items || [];

      for (const item of list) {
        const id = item.unitId;
        if (!id || seen.has(String(id))) continue;
        seen.add(String(id));

        const price = item.finalPrice ?? 0;

        hotels.push({
          id: String(id),
          name: item.unitName || 'Unnamed',
          nameOriginal: item.unitName || '',
          pricePerNightCNY: price,
          pricePerNightEUR: Math.round(price * CNY_TO_EUR),
          rating: item.commentBrief?.overall ?? 0,
          reviewCount: item.commentBrief?.totalCount ?? 0,
          // pictureList is an array of URL strings on this endpoint.
          image: item.pictureList?.[0] || item.defaultPicture || '',
          district: item.districtName || item.cityName || '',
          tags: (item.houseTagsForCD || [])
            .map((t: any) => (typeof t === 'string' ? t : t?.text))
            .filter(Boolean),
          raw: item,
        });
      }
    }

    return hotels;
  }

  async saveResults(hotels: ScrapedHotel[]): Promise<string> {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    const filename = `tujia-${this.options.cityName}-${this.options.checkIn}-${Date.now()}.json`;
    const filepath = path.join(this.options.outputDir, filename);

    const output = {
      meta: {
        cityId: this.options.cityId,
        cityName: this.options.cityName,
        checkIn: this.options.checkIn,
        checkOut: this.options.checkOut,
        guestCount: this.options.guestCount,
        scrapedAt: new Date().toISOString(),
        totalResults: hotels.length,
      },
      hotels,
      rawResponses: this.apiResponses,
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`[✓] Saved ${hotels.length} hotels to ${filepath}`);
    return filepath;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    console.log('[*] Browser closed');
  }

  async run(): Promise<string> {
    try {
      await this.init();
      await this.navigateToSearch();
      await this.scrollToLoadMore(5);
      const hotels = this.extractHotels();
      const filepath = await this.saveResults(hotels);
      return filepath;
    } finally {
      await this.close();
    }
  }
}
