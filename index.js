import puppeteer from "puppeteer";
import fetch from "node-fetch";
// 图鉴api
const apiUrl = "http://api.ttshitu.com/predict";
// 大锦鲤专栏页面
const baseUrl = "https://space.bilibili.com/226257459/article";
console.log(process.env.ACCOUNT);
function sleep(interval) {
  return new Promise((resolve) => {
    setTimeout(resolve, interval);
  });
}

// 将img url 转成 base64 编码（不含：data:image/jpg;base64前缀）
async function getImageDataUrl(page, imageUrl) {
  const imageDataUrl = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, imageUrl);
  return imageDataUrl;
}

// 获取验证码图片url地址、相对浏览器xy坐标
async function getCaptchaImage(page) {
  return await page.evaluate(() => {
    const imgSelector = document.querySelector(".geetest_item_wrap");
    const bgImg = imgSelector.style.backgroundImage;
    const urlReg = /url\("([^"]+)"\)/;
    const { x, y } = imgSelector.getBoundingClientRect();
    return {
      imgUrl: urlReg.exec(bgImg)[1],
      x,
      y,
    };
  });
}

// 获取验证码点击坐标
async function getCoordinate(page) {
  const { imgUrl, x, y } = await getCaptchaImage(page);
  const base64Img = await getImageDataUrl(page, imgUrl);
  const xy = [x, y];
  const response = await fetch(apiUrl, {
    method: "post",
    body: JSON.stringify({
      username: process.env.TUJIAN_ACCOUNT,
      password: process.env.TUJIAN_PASSWORD,
      typeid: "27", // 点选1 ~ 4个坐标
      image: base64Img,
    }),
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  return {
    success: true,
    coordinate: data.data.result.split("|").map(
      (pair) =>
        pair.split(",").map((item, index) => Number(item) + xy[index] - 10) // 10px的偏移量
    ),
  };
}

async function clickOnMultipleCoordinates(page, coordinates) {
  for (const [x, y] of coordinates) {
    await page.mouse.click(x, y);
    await sleep(2000);
  }
  await page.waitForSelector(".geetest_commit");
  await page.click(".geetest_commit");
}

(async () => {
  let count = 0;
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized"],
    defaultViewport: {
      width: 1920,
      height: 929,
    },
  });
  const page = await browser.newPage();

  await page.goto(baseUrl);
  await page.waitForSelector(".unlogin");
  await page.click(".unlogin");
  await sleep(2000);
  await page.waitForSelector(".login-pwd-wp .tab__form");
  await page.type(
    "div.login-pwd-wp > form > div:nth-child(1) > input[type=text]",
    process.env.ACCOUNT
  );
  await page.type(
    "div.login-pwd-wp > form > div:nth-child(3) > input[type=password]",
    process.env.PASSWORD
  );
  await page.click(".btn_primary");
  await sleep(5000);

  // 绕过验证码登录
  const coordinateRes = await getCoordinate(page);

  if (coordinateRes.success) {
    await clickOnMultipleCoordinates(page, coordinateRes.coordinate);
    await sleep(5000);
    const newestLuckyDrawUrl = async () => {
      await page.goto(baseUrl);
      await page.waitForSelector(".article-wrap");
      return await page.evaluate(() => {
        return document.querySelector(".article-wrap a").href;
      });
    };

    // 获取页面中当日的抽奖链接
    const getLuckyDrawList = async () => {
      const url = await newestLuckyDrawUrl();
      await page.goto(url);
      await page.waitForSelector("#article-content");
      const newList = await page.evaluate(() => {
        let data = [];
        let elements = document.querySelectorAll(".article-link");
        for (let i = 0; i < elements.length; i++) {
          let url = elements[i].getAttribute("href");
          data.push(url);
        }
        return data;
      });
      return newList;
    };

    const allList = await getLuckyDrawList();

    // 进入页面并且转发
    const relay = async () => {
      try {
        const page = await browser.newPage();
        page.goto(allList[count], { waitUntil: "domcontentloaded" });
        await sleep(3000);
        // 判断页面中是否有报错，404页面
        const error = await page.$(".error-container");
        if (!error) {
          // 关注up主
          // 将鼠标移入up主头像
          await page.mouse.move(660, 100);
          await page.waitForSelector(".bili-user-profile-view__info__button");
          const isChecked = await page.evaluate(() => {
            return (
              document.querySelector(".bili-user-profile-view__info__button")
                .innerText === "已关注"
            );
          });
          !isChecked &&
            (await page.click(".bili-user-profile-view__info__button"));
          await sleep(2000);
          // 评论
          await page.waitForSelector(".textarea-container > .ipt-txt");
          await page.waitForSelector(".textarea-container > .comment-submit");
          await page.evaluate(() => {
            document.querySelector(".textarea-container > .ipt-txt").value =
              "拿来吧你!";
          });
          await page.click(".textarea-container > .comment-submit");
          await sleep(1000);
          // 点赞
          await page.waitForSelector(".bili-dyn-item__action");
          await page.click(".bili-dyn-item__action > .like");
          await sleep(1000);
          // 点击转发按钮
          await page.click(".bili-dyn-item__action > .forward");
          await page.waitForSelector(
            "button.bili-dyn-forward-publishing__action__btn"
          );
          await page.click("button.bili-dyn-forward-publishing__action__btn");
          await sleep(5000);
        }
        page.close();
        count++;
      } catch (error) {
        page.close();
        count++;
      }

      if (count < allList.length) {
        relay();
      } else {
        await browser.close();
        process.exit(0);
      }
    };

    relay();
  } else {
    process.exit(1);
  }
})();
