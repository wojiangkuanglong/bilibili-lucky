import puppeteer, { Browser, Page } from "puppeteer";
import fetch from "node-fetch";

const API_URL: string = "http://api.ttshitu.com/predict";
const BASE_URL: string = "https://space.bilibili.com/226257459/article";

const sleep = (interval: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, interval));

interface CaptchaImage {
  imgUrl: string;
  x: number;
  y: number;
}

interface CoordinateResult {
  success: boolean;
  coordinate: number[][];
}

async function getImageDataUrl(page: Page, imageUrl: string): Promise<string> {
  return await page.evaluate(async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, imageUrl);
}

async function getCaptchaImage(page: Page): Promise<CaptchaImage> {
  return await page.evaluate(() => {
    const imgSelector = document.querySelector(".geetest_item_wrap") as HTMLElement;
    const bgImg = imgSelector.style.backgroundImage;
    const urlReg = /url\("([^"]+)"\)/;
    const { x, y } = imgSelector.getBoundingClientRect();
    return { imgUrl: urlReg.exec(bgImg)![1], x, y };
  });
}

// 验证码处理相关函数
async function getCoordinate(page: Page): Promise<CoordinateResult> {
  const { imgUrl, x, y } = await getCaptchaImage(page);
  const base64Img = await getImageDataUrl(page, imgUrl);
  const xy = [x, y];
  const response = await fetch(API_URL, {
    method: "post",
    body: JSON.stringify({
      username: process.env.TUJIAN_ACCOUNT,
      password: process.env.TUJIAN_PASSWORD,
      typeid: "27",
      image: base64Img,
    }),
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  return {
    success: data.success,
    coordinate: data.data.result.split("|").map(
      (pair: string) =>
        pair.split(",").map((item: string, index: number) => Number(item) + xy[index] - 10)
    ),
  };
}

async function clickOnMultipleCoordinates(page: Page, coordinates: number[][]): Promise<void> {
  for (const [x, y] of coordinates) {
    await page.mouse.click(x, y);
    await sleep(2000);
  }
  await page.waitForSelector(".geetest_commit");
  await page.click(".geetest_commit");
}

// 主要业务逻辑
class BilibiliLucky {
  private browser: Browser;
  private page: Page;
  private allList: string[] = [];
  private count: number = 0;

  constructor() {}

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
      defaultViewport: { width: 1920, height: 929 },
    });
    this.page = await this.browser.newPage();
  }

  async login(): Promise<void> {
    await this.page.goto(BASE_URL);
    await this.page.waitForSelector(".go-login-btn");
    await this.page.click(".go-login-btn");
    await sleep(2000);
    await this.page.waitForSelector(".login-pwd-wp .tab__form");
    await this.page.type(
      "div.login-pwd-wp > form > div:nth-child(1) > input[type=text]",
      process.env.ACCOUNT!
    );
    await this.page.type(
      "div.login-pwd-wp > form > div:nth-child(3) > input[type=password]",
      process.env.PASSWORD!
    );
    await this.page.click(".btn_primary");
    await sleep(5000);

    const coordinateRes = await getCoordinate(this.page);
    if (coordinateRes.success) {
      await clickOnMultipleCoordinates(this.page, coordinateRes.coordinate);
      await sleep(5000);
    } else {
      throw new Error("验证码识别失败");
    }
  }

  async getNewestLuckyDrawUrl(): Promise<string> {
    await this.page.goto(BASE_URL);
    await this.page.waitForSelector(".article-card__no-img");
    return await this.page.evaluate(() =>
      (document.querySelector(".article-card__no-img a") as HTMLAnchorElement).href
    );
  }

  async getLuckyDrawList(): Promise<void> {
    const url = await this.getNewestLuckyDrawUrl();
    await this.page.goto(url);
    await this.page.waitForSelector("#article-content");
    this.allList = await this.page.evaluate(() => {
      const data: string[] = [];
      const elements = document.querySelectorAll<HTMLAnchorElement>("#read-article-holder a[href^='https://t.bilibili.com']");
      elements.forEach((element) => {
        const url = element.getAttribute("href");
        if (url) data.push(url);
      });
      return data;
    });
  }

  async relay(): Promise<void> {
    try {
      const page: Page = await this.browser.newPage();
      await page.goto(this.allList[this.count], { waitUntil: "domcontentloaded" });
      await sleep(3000);

      const error = await page.$(".error-container");
      if (!error) {
        await this.followUpUser(page);
        await this.like(page);
        await this.commentAndForward(page);
      }

      await page.close();
      this.count++;
    } catch (error) {
      console.error("转发过程中出错:", error);
      this.count++;
    }

    if (this.count < this.allList.length) {
      await this.relay();
    } else {
      await this.browser.close();
      process.exit(0);
    }
  }

  /** 关注用户 */
  private async followUpUser(page: Page): Promise<void> {
    try {
      await page.waitForSelector(".opus-text-rich-hl.at");
      const firstAtElement = await page.$(".opus-text-rich-hl.at");
      
      if (!firstAtElement) {
        console.log("未找到@元素，跳过关注操作");
        return;
      }

      const boundingBox = await firstAtElement.boundingBox();
      if (!boundingBox) {
        console.log("无法获取@元素位置，跳过关注操作");
        return;
      }

      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );

      await page.waitForSelector(".bili-user-profile-view__info__button");
      
      const isChecked = await page.evaluate(() => {
        const button = document.querySelector(".bili-user-profile-view__info__button");
        return button instanceof HTMLElement && button.innerText === "已关注";
      });

      if (!isChecked) {
        await page.click(".bili-user-profile-view__info__button");
        console.log("成功关注用户");
      } else {
        console.log("已经关注过该用户");
      }

      await sleep(2000);
    } catch (error) {
      console.error("关注用户过程中出错:", error);
    }
  }

  /** 点赞 */
  private async like(page: Page): Promise<void> {
    await page.waitForSelector(".side-toolbar__action.like");
    await page.click(".side-toolbar__action.like");
    await sleep(1000);
  }

  /** 评论和转发 */ 
  private async commentAndForward(page: Page): Promise<void> {
    await page.waitForSelector(".side-toolbar__action.comment");
    await page.click(".side-toolbar__action.comment");
    await sleep(2000);
    // 评论

  }

  async run(): Promise<void> {
    await this.initialize();
    await this.login();
    await this.getLuckyDrawList();
    await this.relay();
  }
}

(async () => {
  const bilibiliLucky = new BilibiliLucky();
  await bilibiliLucky.run();
})();
