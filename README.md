# 箭头迷宫

一个点击消除类箭头迷宫小游戏。玩家需要观察每条箭头前方是否被其他箭头阻挡，选择可以滑出棋盘的箭头，逐步清空关卡。

## 箭头特点

- 每个箭头是一条连续折线，不是单独的小箭头。
- 箭头头部始终沿最后一段线的方向延伸。
- 箭头不会在结尾处强行折回或突然掉头。
- 只有自然朝外、且前方无遮挡的出口箭头可以离开棋盘。

## 移出规则

点击箭头时，会从箭头头部的前方一直检查到棋盘边界：

- 如果前方没有其他箭头，箭头会沿自身方向滑出。
- 如果前方有其他箭头阻挡，本次点击失败并扣除一颗心。
- 被阻挡时会短暂高亮阻挡方向，帮助判断下一步。

## 界面元素

- 顶部显示关卡、生命和倒计时。
- 右上角三点按钮可查看箭头特点说明。
- 底部包含提示、清除和重排方向等道具按钮。

## 本地运行

在项目目录启动静态服务：

```bash
python -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173/index.html
```

## Ubuntu 部署

项目提供了 Nginx 静态站点部署脚本：

```bash
chmod +x deploy-ubuntu.sh
sudo ./deploy-ubuntu.sh
```

脚本会自动完成：

- 安装缺失的 `nginx` 和 `rsync`。
- 将 `index.html`、`game.js`、`styles.css` 部署到 `/var/www/asnake`。
- 如果项目中存在 `assets/` 目录，会同步到部署目录。
- 写入 Nginx 站点配置。
- 禁用 Ubuntu 自带的 Nginx 默认站点，避免访问服务器 IP 时显示 `Welcome to nginx!`。
- 执行 `nginx -t` 检查配置。
- 启用并重载 Nginx。

### 自定义部署参数

可以通过环境变量调整应用名、域名、端口和部署目录：

```bash
sudo APP_NAME=asnake DOMAIN=example.com PORT=8080 DEPLOY_DIR=/var/www/asnake ./deploy-ubuntu.sh
```

常用参数：

- `APP_NAME`：应用名，默认 `asnake`。
- `DOMAIN`：Nginx `server_name`，默认 `_`，表示匹配服务器默认站点。
- `PORT`：监听端口，默认 `80`。
- `DEPLOY_DIR`：静态文件部署目录，默认 `/var/www/asnake`。

部署完成后，访问脚本输出的地址即可打开游戏。
