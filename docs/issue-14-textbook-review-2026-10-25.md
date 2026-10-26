# #14：人教版小学数学修订版核对（2026-10-25）

本次核对国家中小学智慧教育平台当前教材目录的全部 3,565 个条目，筛出 12 册人教版小学数学。其中 9 册明确标注“根据2022年版课程标准修订”：二上、三上已更新，本轮补齐其余七册；四下、五下、六下尚无该标记，保留现有版本。

新版展示为“2022课标修订版”。ID 后缀 `-2026` 表示本项目的独立内容版本，不表示下册的秋季印次。旧版教材、课时、宝箱和成绩继续保留。

| 新版 | 旧版 ID → 新版 ID | 单元/实践 | 配套课时 | 官方页数 |
| --- | --- | ---: | ---: | ---: |
| [一年级下册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=6bf8ae7e-d987-40b4-8fb3-bbb98fcb50b5) | `g1down` → `g1down-2026` | 8 | 38 | 98 |
| [一年级上册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=c3e06fe4-c6b3-49cb-8727-4f8ff69bbfbc) | `g1up` → `g1up-2026` | 7 | 38 | 118 |
| [二年级下册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=c1897b18-b302-4e8d-9fd4-40915c4b05c2) | `g2down` → `g2down-2026` | 7 | 41 | 106 |
| [三年级下册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=8666a8bd-a0e7-49aa-ba07-bf419ceead24) | `g3down` → `g3down-2026` | 8 | 38 | 114 |
| [四年级上册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=654e3d1e-c995-4340-81c5-abd7881d835b) | `g4up` → `g4up-2026` | 9 | 37 | 127 |
| [五年级上册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=d0d6252f-2233-4f66-9ac9-440638d56fec) | `g5up` → `g5up-2026` | 9 | 51 | 126 |
| [六年级上册](https://basic.smartedu.cn/tchMaterial/detail?contentType=assets_document&contentId=845136d4-e27b-4e7e-b9a9-00cadf4f9e20) | `g6up` → `g6up-2026` | 9 | 47 | 126 |

合计 57 个单元/实践、290 个配套课时、1,740 道课内题和 342 道单元挑战题。配套题按正文知识范围原创编排，不宣称为教材原题或原有逐课标题。

## 核对方法与边界

- 七册目录及封底已逐图查看，页数、目录顺序和印刷页偏移核准；815 张官方公开页面保存来源地址、大小及 SHA-256，逐单元使用完整正文 OCR 作为范围依据。
- 修正初稿中六上“确定位置”、分数乘除法及“生活中的负数”的错误单元顺序；四上复习包含鸡兔同笼，六上复习包含鸽巢问题，均保留到正文末页。
- 复习、综合与实践按官方位置排列，沿用独立编号 101/102/103，不按数值强行移到末尾。
- 每题给足文字条件，不根据 OCR 猜补未呈现的图像。分数计算使用选择题，数值输入仅接受整数或有限小数。近似、观察方向和分组规则必须明确。
- 内容经过逐题重算、修正、独立复核和官方正文主要主题覆盖核验；这属于机器审校，不等于教师签审或儿童实测。最终指纹、审校记录随资源清单保存。
- 本轮还修正旧六下鸽巢问题两条损坏讲解公式，题目、标准答案及 ID 不变；基线逐项记录精确前后指纹，不放宽题库保留检查。

本轮另修正旧二下单元挑战中“积/商”的术语笔误，以及旧五上小数乘法一题的错误验算；题号和标准答案不变，修订前后全文及基线指纹另见 `docs/restored-content-fixes.json`。

完整目录、逐单元范围及页面指纹见[机器可读核对记录](issue-14-textbook-review-2026-10-25.json)。发布结果另记录在[上线验收报告](issue-14-release-2026-10-25.md)。
