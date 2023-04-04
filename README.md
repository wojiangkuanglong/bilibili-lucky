# B站抽奖脚本

基于up主大锦鲤的[专栏](https://space.bilibili.com/226257459/article)，配合github actions使用

# 使用
1. fork此仓库，必须在github上fork
2. 点击Settings->Secrets and variables->Actions->New repository secret，依次配置`ACCOUNT`、`PASSWORD`、`TUJIAN_ACCOUNT`、`TUJIAN_PASSWORD`
    - ACCOUNT 是bilibili的账号
    - PASSWORD 是bilibili的密码
    - TUJIAN_ACCOUNT 是[图鉴](http://www.ttshitu.com/)的账号
    - TUJIAN_ACCOUNT 是图鉴的密码
3. UTC时间的每天01:00分（北京时间：09:00，并不准时），github actions会自动帮助您抽奖，如果您配置了server酱的key的话，您将收到微信消息通知
4. enjoy it!!!

# 特性

1. 每次登陆成功后，自动更新hosts.txt，避免因为host被墙，而自动签到失败
2. 完全免费，不需要服务器，与云函数