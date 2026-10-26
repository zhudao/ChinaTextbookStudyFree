# 发布资源的组织方式

主发布页提供在线课堂、安装器、下载导航及校验信息。较大的 Web 资源与 iOS 逐册资源分别放到两个资源发布页，避免在主入口混排上百个附件。旧发布页的文件与地址保留。

新版清单仍使用 schema 2：`tag` 是主发布版本，`resource_tag` 指向同一仓库的 Web 资源版本，`ios_resource_tag` 指向 iOS 资源版本。安装器先获取主清单，再按安装模式下载 Web 包和逐文件清单；iOS App 从其资源版本按册获取数据与 AAC 两包。未提供这两个字段的旧版清单按原来方式安装。

iOS 资源页也必须提供 `ios-manifest.json`，因为客户端从分册包所在的同一个基础地址获取索引。主入口保留一份索引供跨平台下载导航使用；这两份元数据应逐字节一致。

## 维护者打包

先完成内容保留、判分、音频、客户端与静态网站测试，记录配套源码提交。三个版本标签应指向同一源码提交，已公开的标签与二进制包不移动、不覆盖。

```sh
python3 scripts/package-release.py v1.7.0 \
  --site-root deploy-output/site-math-v170 \
  --resource-tag v1.7.0-web-resources \
  --ios-resource-tag v1.7.0-ios-resources

IOS_ASSETS_OUT="$PWD/release-assets/v1.7.0-ios" \
  bash scripts/package-release-ios.sh

python3 scripts/organize-release.py \
  --combined release-assets/v1.7.0 \
  --ios release-assets/v1.7.0-ios \
  --site deploy-output/site-math-v170 \
  --validation deploy-output/open-issues/local-validation.json \
  --out release-assets/v1.7.0-organized
```

组织脚本先验证所有归档的大小、SHA-256、教材 ID 与文件清单，再生成三个同名上传目录。二进制包字节不变；本地完整目录继续支持离线安装和审计。将 `DOWNLOADS.md` 同步至本版本的下载导航文档。

发布资源版本时使用预发布状态，主版本在上线验收前也保持预发布；确认匿名下载、全新安装、旧目录升级、线上教材、音频和旧成绩后，再将主版本标为正式版本。资源版本保留预发布状态，避免成为 GitHub 默认最新入口。最终验收元数据可以补充更新，但不得据此重打或替换已经发布的二进制包。

## 回归检查

```sh
python3 scripts/checks/release-installer.py
python3 scripts/checks/release-v2.py
python3 scripts/checks/release-organization.py
```

这些检查覆盖旧清单兼容、新旧安装、资源分类链接、损坏分包在写入前被拒绝、路径校验及版本化音频隔离。每次实际发布还需要使用完整资源做安装与上线验证，不能仅用小型测试替代。
