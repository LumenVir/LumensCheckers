# LumensChecker

**闪光跳棋 | Lumen's Checker** 是一款适合亲友围坐对弈的网页版跳棋。打开网页就能玩，不需要安装应用；目前支持两至六位参与者，其中最多可以有一位简单电脑。

作者：Lumen与家人、Dorothy（CodexAgent)。玩法与体验来自家庭对局和持续反馈，Dorothy 参与了设计、代码实现与测试。

当前版本：**v3.3**。版本变化见 [更新日志](CHANGELOG.md)，后续计划见 [待办事项](TODO.md)。

## 游戏功能

- 按人数分配营地，逆时针轮换回合
- 相邻移动、连续跳跃与隔空跳跃
- 一位有限路线、只评估当前一步的简单电脑
- 整回合悔棋、正计时、胜利排名与结算动画
- 玩家卡片、本局金币、长期余额和名次奖励
- 本地积分保险箱，支持导入和导出积分备份
- 电脑与 iPad 横屏布局，棋盘四角均可结束回合
- 棋盘落点和棋子具有独立调试 ID

## 在另一台电脑继续开发

克隆仓库后即可运行游戏。网页不需要安装前端依赖，也不需要构建。

```bash
git clone <你的 GitHub 仓库地址>
cd LumensChecker
```

用浏览器打开 `checkers-web/index.html`。如果浏览器限制直接打开本地文件，可在项目根目录启动静态服务器：

```bash
python3 -m http.server 8000 --directory checkers-web
```

然后访问 <http://localhost:8000>。在 Windows 上，如果 `python3` 不可用，可以尝试 `py -m http.server 8000 --directory checkers-web`。

运行规则和积分备份测试需要 Node.js：

```bash
node --test checkers-web/rules.test.js checkers-web/profile-backup.test.js
node --check checkers-web/app.js
```

## 代码位置

| 路径 | 用途 |
| --- | --- |
| `checkers-web/index.html` | 正式网页入口 |
| `checkers-web/style.css` | 棋盘与界面样式 |
| `checkers-web/app.js` | 回合、动画、计分和交互 |
| `checkers-web/rules.js` | 棋盘、合法落点、电脑策略和胜利规则 |
| `checkers-web/profile-backup.js` | 玩家积分备份格式 |
| `checkers-web/*.test.js` | 规则与备份测试 |
| `docs/` | 棋局设计方案与界面原型 |
| `CHANGELOG.md`、`TODO.md` | 版本记录与待办事项 |

`checkers/` 保存了早期的跳棋规则实验；`releases/` 保存了旧版跳棋存档。日常修改以 `checkers-web/` 为准。

## 玩家数据与换设备

玩家卡片、长期金币和上局阵容存储在当前浏览器中。Git 同步的是代码，不会同步这些数据。换设备前，在游戏初始页右上角打开“积分保险箱”并导出备份；在新设备上再导入。当前版本不保存进行中的棋盘残局。

## 发布

游戏是纯静态网页。发布新版本时，更新 `checkers-web/index.html` 中的版本号及资源查询参数，运行测试，记录变更，然后部署 `checkers-web/` 中的运行文件。不要把测试文件、开发文档或整个仓库上传到静态托管目录。
