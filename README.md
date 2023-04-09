# B 站抽奖脚本

基于 up 主大锦鲤的[专栏](https://space.bilibili.com/226257459/article)

# 使用

1. 本地按照.env.exmaple 的格式创建.env 文件
   - ACCOUNT 是 bilibili 的账号
   - PASSWORD 是 bilibili 的密码
   - TUJIAN_ACCOUNT 是[图鉴](http://www.ttshitu.com/)的账号
   - TUJIAN_PASSWORD 是图鉴的密码
2. npm start
3. enjoy it

# 特性

1. 自动登录 B 站，绕过验证码，无需手动更新 cookies
2. 完全免费，不需要服务器，与云函数
3. 可迁移至 GitHub Actions 或者青龙面板
