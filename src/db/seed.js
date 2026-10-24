/**
 * 示例种子数据 — 开发调试用
 *
 * 规模：3 个房支（长房 B01 / 二房 B02 / 三房 B03）× 10 个世代（守·德·建·志·承·先·泽·延·熙·昆）
 * 人物：约 200 人（本族 + 配偶），年代按每代约 30 年推演（清乾隆 → 当代）
 *
 * 结构：
 *   手写部分（第 1–6 世）承载全部关键宗法场景，人物与 ID 稳定，测试基线依赖它们：
 *     嫁娶 · 多配偶（元配/续弦）· 入赘 · 出赘 · 过继 · 外嫁女 · 外嫁女子女入谱 ·
 *     离异 · 在世/已故 · 大宗分房 · 缺资料（仅必填字段）
 *   派生部分（第 4–10 世）按「字辈 + 房支 + 世次」规则生成，用于规模验证。
 *
 * 人物与事件均为虚构。
 *
 * 形态：普通 script（挂 window.ZP.SEED），依赖 schema.js 先加载。
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var S = ZP.schema;
  var CATEGORY = S.CATEGORY, LINEAGE = S.LINEAGE, MARRIAGE_TYPE = S.MARRIAGE_TYPE,
      MARRIAGE_STATUS = S.MARRIAGE_STATUS, GENDER = S.GENDER;

  var now = Date.now();

  var rawPersons = [
    /* ══════════ 第 1 世 · 守字辈（始祖） ══════════ */
    {
      id: 'B01-G01-001', surname: '王', name: '守义', namePinyin: 'shouyi',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 1, generationName: '守', birthOrder: 1,
      birthDate: '1740', deathDate: '1807',
      fatherId: null, motherId: null, branchId: 'B01',
      nativePlace: '浙江宁波', occupation: '农',
      bio: '始迁祖。清乾隆年间自绍兴迁居宁波，耕读传家，生三子：德福、德禄、德华。'
    },
    {
      id: 'B01-G01-002', surname: '陈', name: '桂香', namePinyin: 'guixiang',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 1, birthOrder: 1,
      birthDate: '1744', deathDate: '1818', branchId: 'B01'
    },

    /* ══════════ 第 2 世 · 德字辈（三房分家） ══════════ */
    {
      id: 'B01-G02-001', surname: '王', name: '德福', namePinyin: 'defu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 1,
      birthDate: '1770', deathDate: '1843',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B01',
      occupation: '农', notes: '长房'
    },
    {
      id: 'B02-G02-001', surname: '王', name: '德禄', namePinyin: 'delu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 2,
      birthDate: '1773', deathDate: '1855',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B02',
      notes: '二房'
    },
    {
      id: 'B03-G02-001', surname: '王', name: '德华', namePinyin: 'dehua',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 3,
      birthDate: '1776', deathDate: '1850',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B03',
      notes: '三房'
    },
    // 长房德福配氏（多配偶：元配 + 续弦）
    {
      id: 'B01-G02-002', surname: '李', name: '秀英', namePinyin: 'xiuying',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1772', deathDate: '1838', branchId: 'B01'
    },
    {
      id: 'B01-G02-003', surname: '张', name: '桂芳', namePinyin: 'guifang',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 2,
      birthDate: '1785', deathDate: '1853', branchId: 'B01'
    },
    {
      id: 'B02-G02-002', surname: '周', name: '玉珍', namePinyin: 'yuzhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1775', deathDate: '1858', branchId: 'B02'
    },
    {
      id: 'B03-G02-002', surname: '何', name: '凤仙', namePinyin: 'fengxian',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1778', deathDate: '1861', branchId: 'B03'
    },

    /* ══════════ 第 3 世 · 建字辈 ══════════ */
    {
      id: 'B01-G03-001', surname: '王', name: '建国', namePinyin: 'jianguo',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1800', deathDate: '1873',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      occupation: '教师', notes: '无亲生子，过继胞弟建华之子志强为嗣'
    },
    {
      id: 'B01-G03-002', surname: '王', name: '建华', namePinyin: 'jianhua',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 2,
      birthDate: '1803', deathDate: '1876',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      occupation: '工人'
    },
    // 外嫁女（其子女可选入谱）
    {
      id: 'B01-G03-003', surname: '王', name: '秀兰', namePinyin: 'xiulan',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.OUT_MARRIED,
      generation: 3, generationName: '建', birthOrder: 3,
      birthDate: '1805', deathDate: '1880',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      notes: '嫁陈家'
    },
    {
      id: 'B01-G03-004', surname: '刘', name: '淑珍', namePinyin: 'shuzhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1802', deathDate: '1875', branchId: 'B01'
    },
    {
      id: 'B01-G03-005', surname: '周', name: '秀云', namePinyin: 'xiuyun',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 2,
      birthDate: '1805', deathDate: '1878', branchId: 'B01'
    },
    {
      id: 'B02-G03-001', surname: '王', name: '建军', namePinyin: 'jianjun',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1801', deathDate: '1874',
      fatherId: 'B02-G02-001', motherId: 'B02-G02-002', branchId: 'B02'
    },
    {
      id: 'B02-G03-002', surname: '王', name: '建平', namePinyin: 'jianping',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 2,
      birthDate: '1807', deathDate: '1880',
      fatherId: 'B02-G02-001', motherId: 'B02-G02-002', branchId: 'B02'
    },
    {
      id: 'B02-G03-003', surname: '徐', name: '佩兰', namePinyin: 'peilan',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1803', deathDate: '1877', branchId: 'B02'
    },
    {
      id: 'B03-G03-001', surname: '王', name: '建中', namePinyin: 'jianzhong',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1805', deathDate: '1878',
      fatherId: 'B03-G02-001', motherId: 'B03-G02-002', branchId: 'B03'
    },
    {
      id: 'B03-G03-002', surname: '马', name: '丽华', namePinyin: 'lihua',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1808', deathDate: '1881', branchId: 'B03'
    },

    /* ══════════ 第 4 世 · 志字辈 ══════════ */
    // 过继：建华之子 → 嗣父建国（世系图归嗣父，自动标注本生父）
    {
      id: 'B01-G04-001', surname: '王', name: '志强', namePinyin: 'zhiqiang',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1830', deathDate: '1900',
      fatherId: 'B01-G03-002', adoptiveFatherId: 'B01-G03-001', branchId: 'B01',
      occupation: '工程师', notes: '过继给建国为嗣'
    },
    // 外嫁女子女入谱：仅挂生母，随母姓（外系）
    {
      id: 'B01-G04-002', surname: '陈', name: '明', namePinyin: 'chenming',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.EXTERNAL,
      generation: 4, birthOrder: 2,
      birthDate: '1833', deathDate: '1905',
      motherId: 'B01-G03-003', branchId: 'B01',
      notes: '外嫁女秀兰之子，随母入谱'
    },
    {
      id: 'B01-G04-003', surname: '王', name: '志刚', namePinyin: 'zhigang',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 2,
      birthDate: '1835', deathDate: '1907',
      fatherId: 'B01-G03-001', motherId: 'B01-G03-004', branchId: 'B01',
      occupation: '医生'
    },
    {
      id: 'B01-G04-004', surname: '赵', name: '丽娟', namePinyin: 'lijuan',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1828', deathDate: '1903', branchId: 'B01'
    },
    {
      id: 'B01-G04-005', surname: '孙', name: '晓梅', namePinyin: 'xiaomei',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1837', deathDate: '1910', branchId: 'B01'
    },
    // 招赘：本族女志敏 + 赘婿吴国梁（入赘），子女随母姓、挂母系
    {
      id: 'B01-G04-006', surname: '王', name: '志敏', namePinyin: 'zhimin',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 3,
      birthDate: '1836', deathDate: '1909',
      fatherId: 'B01-G03-001', motherId: 'B01-G03-004', branchId: 'B01',
      notes: '招赘吴国梁'
    },
    {
      id: 'B01-G04-007', surname: '吴', name: '国梁', namePinyin: 'guoliang',
      gender: GENDER.MALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1835', deathDate: '1908', branchId: 'B01',
      notes: '入赘王家'
    },
    {
      id: 'B02-G04-001', surname: '王', name: '志远', namePinyin: 'zhiyuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1832', deathDate: '1902',
      fatherId: 'B02-G03-001', motherId: 'B02-G03-003', branchId: 'B02'
    },
    {
      id: 'B02-G04-002', surname: '王', name: '志宁', namePinyin: 'zhining',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 2,
      birthDate: '1836', deathDate: '1911',
      fatherId: 'B02-G03-001', motherId: 'B02-G03-003', branchId: 'B02',
      notes: '嫁陈家，后离异；子随母入谱'
    },
    // 出赘：本族男志安出赘他家，后代不入本谱主线
    {
      id: 'B02-G04-003', surname: '王', name: '志安', namePinyin: 'zhian',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 3,
      birthDate: '1838', deathDate: '1913',
      fatherId: 'B02-G03-002', branchId: 'B02',
      notes: '出赘林家，后代不入本谱主线'
    },
    {
      id: 'B02-G04-004', surname: '林', name: '巧珍', namePinyin: 'qiaozhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1834', deathDate: '1909', branchId: 'B02'
    },
    {
      id: 'B02-G04-005', surname: '郑', name: '美玲', namePinyin: 'meiling',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1839', deathDate: '1915', branchId: 'B02'
    },
    // 离异：二房志宁之夫（入谱为配偶）
    {
      id: 'B02-G04-006', surname: '陈', name: '志豪', namePinyin: 'chenzhihao',
      gender: GENDER.MALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1834', deathDate: '1908', branchId: 'B02'
    },
    {
      id: 'B03-G04-001', surname: '王', name: '志斌', namePinyin: 'zhibin',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1834', deathDate: '1903',
      fatherId: 'B03-G03-001', motherId: 'B03-G03-002', branchId: 'B03'
    },

    /* ══════════ 第 5 世 · 承字辈 ══════════ */
    {
      id: 'B01-G05-001', surname: '王', name: '承杰', namePinyin: 'chengjie',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '1860', deathDate: '1930',
      fatherId: 'B01-G04-001', motherId: 'B01-G04-004', branchId: 'B01',
      occupation: '教书'
    },
    {
      id: 'B01-G05-002', surname: '王', name: '承悦', namePinyin: 'chengyue',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 2,
      birthDate: '1864', deathDate: '1935',
      fatherId: 'B01-G04-003', motherId: 'B01-G04-005', branchId: 'B01'
    },
    // 入赘所生：生父为赘婿（配偶），世系归生母志敏，随母姓
    {
      id: 'B01-G05-003', surname: '王', name: '承轩', namePinyin: 'chengxuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 3,
      birthDate: '1871', deathDate: '1940',
      fatherId: 'B01-G04-007', motherId: 'B01-G04-006', branchId: 'B01',
      notes: '入赘所生，随母姓'
    },
    {
      id: 'B02-G05-001', surname: '王', name: '承宇', namePinyin: 'chengyu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '1858', deathDate: '1928',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    {
      id: 'B02-G05-002', surname: '王', name: '承业', namePinyin: 'chengye',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 2,
      birthDate: '1862', deathDate: '1932',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    {
      id: 'B02-G05-003', surname: '王', name: '承欢', namePinyin: 'chenghuan',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 3,
      birthDate: '1864', deathDate: '1936',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    // 外嫁女志宁之子，随母入谱（外系）
    {
      id: 'B02-G05-004', surname: '陈', name: '嘉轩', namePinyin: 'chenjiaxuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.EXTERNAL,
      generation: 5, birthOrder: 4,
      birthDate: '1860', deathDate: '1930',
      motherId: 'B02-G04-002', branchId: 'B02',
      notes: '外嫁女志宁之子，随母入谱'
    },
    {
      id: 'B03-G05-001', surname: '王', name: '承曦', namePinyin: 'chengxi',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '1863', deathDate: '1933',
      fatherId: 'B03-G04-001', branchId: 'B03'
    },

    /* ══════════ 第 6 世 · 先字辈 ══════════ */
    {
      id: 'B01-G06-001', surname: '王', name: '先禾', namePinyin: 'xianhe',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 6, generationName: '先', birthOrder: 1,
      birthDate: '1890', deathDate: '1960',
      fatherId: 'B01-G05-001', branchId: 'B01'
    }
  ];

  var SEED_MARRIAGES = [
    // 始祖
    {
      id: 'M-001', husbandId: 'B01-G01-001', wifeId: 'B01-G01-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1765', endYear: '1807'
    },
    // 长房德福 · 元配
    {
      id: 'M-002', husbandId: 'B01-G02-001', wifeId: 'B01-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1795', endYear: '1838'
    },
    // 长房德福 · 续弦（多配偶）
    {
      id: 'M-003', husbandId: 'B01-G02-001', wifeId: 'B01-G02-003',
      type: MARRIAGE_TYPE.MARRY, order: 2, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1840', endYear: '1843'
    },
    // 二房
    {
      id: 'M-004', husbandId: 'B02-G02-001', wifeId: 'B02-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1798', endYear: '1855'
    },
    // 三房
    {
      id: 'M-005', husbandId: 'B03-G02-001', wifeId: 'B03-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1801', endYear: '1850'
    },
    // 建字辈
    {
      id: 'M-006', husbandId: 'B01-G03-001', wifeId: 'B01-G03-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1825', endYear: '1873'
    },
    {
      id: 'M-007', husbandId: 'B01-G03-002', wifeId: 'B01-G03-005',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1826', endYear: '1876'
    },
    {
      id: 'M-008', husbandId: 'B02-G03-001', wifeId: 'B02-G03-003',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1827', endYear: '1874'
    },
    {
      id: 'M-009', husbandId: 'B03-G03-001', wifeId: 'B03-G03-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1829', endYear: '1878'
    },
    // 志字辈
    {
      id: 'M-010', husbandId: 'B01-G04-001', wifeId: 'B01-G04-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1852', endYear: '1900'
    },
    {
      id: 'M-011', husbandId: 'B01-G04-003', wifeId: 'B01-G04-005',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1859', endYear: '1907'
    },
    // 入赘
    {
      id: 'M-012', husbandId: 'B01-G04-007', wifeId: 'B01-G04-006',
      type: MARRIAGE_TYPE.RUZHUI, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1857', endYear: '1908', notes: '赘婿入王家'
    },
    {
      id: 'M-013', husbandId: 'B02-G04-001', wifeId: 'B02-G04-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1855', endYear: '1902'
    },
    // 出赘
    {
      id: 'M-014', husbandId: 'B02-G04-003', wifeId: 'B02-G04-005',
      type: MARRIAGE_TYPE.CHUZHUI, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1862', endYear: '1913', notes: '出赘林家'
    },
    // 离异
    {
      id: 'M-015', husbandId: 'B02-G04-006', wifeId: 'B02-G04-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.DIVORCED,
      startYear: '1858', endYear: '1868'
    }
  ];

  /* ══════════════════════════════════════════════════════════
   * 规模化派生：把族谱撑到 10 世 / 200 人量级
   *
   * 规则：
   *  - 只从未被场景用例「占用」的本族男性派生后代（建国 / 建华 / 秀兰 / 建军 /
   *    志敏 / 志宁 / 志安 的名下子嗣是测试基线，不再追加）
   *  - 子女继承父系房支，世次 = 父世次 + 1，姓名 = 字辈 + 尾字
   *  - 为本族男性配一位配氏并生成婚姻；女儿记为本族外嫁女，不入配偶
   *  - 第 1–8 世均已故，第 9–10 世在世
   * ══════════════════════════════════════════════════════════ */

  var EXT_PLAN = [
    { gen: 4,  males: 4,  females: 1, spouses: 4 },
    { gen: 5,  males: 6,  females: 1, spouses: 6 },
    { gen: 6,  males: 10, females: 2, spouses: 10 },
    { gen: 7,  males: 15, females: 2, spouses: 15 },
    { gen: 8,  males: 16, females: 2, spouses: 16 },
    { gen: 9,  males: 14, females: 1, spouses: 13 },
    { gen: 10, males: 11, females: 2, spouses: 5 }
  ];

  /** 字辈诗：守德建志承先泽延熙昆 */
  var GEN_POEM = ['守', '德', '建', '志', '承', '先', '泽', '延', '熙', '昆'];

  /** 各世次尾字池（同世不重名） */
  var TAIL = {
    4: ['邦', '国', '华', '昌', '盛', '隆', '兴', '泰', '康', '宁', '安', '平', '和', '顺', '达', '通', '明', '亮', '清', '远'],
    5: ['宗', '祖', '恩', '惠', '泽', '润', '滋', '培', '育', '荫', '芳', '馨', '茂', '盛', '荣', '昌', '厚', '德', '仁', '义'],
    6: ['启', '迪', '昭', '焕', '炳', '焯', '煊', '烨', '朗', '旭', '晨', '曦', '晖', '曜', '昶', '晓', '昕', '映', '晴', '昀'],
    7: ['润', '沛', '涵', '浩', '涛', '澜', '澄', '浚', '源', '汇', '洋', '洲', '汀', '沁', '沂', '沅', '湘', '淮', '济', '泳'],
    8: ['绍', '绳', '维', '纲', '纪', '绪', '经', '纬', '纶', '绶', '缨', '绣', '纹', '绫', '绵', '绎', '纮', '绚', '继', '纯'],
    9: ['煦', '燦', '焕', '焯', '煌', '煜', '烜', '熤', '熥', '燊', '燮', '燿', '煇', '煖', '熳', '燐', '燏', '燠', '燔', '炤'],
    10: ['仑', '岗', '峻', '峰', '岳', '崇', '嵩', '岭', '岩', '峤', '岷', '峥', '嵘', '嶂', '岫', '峄', '屿', '崟', '嶟', '岿']
  };

  /** 配氏姓氏池与名字池 */
  var WIFE_SURNAMES = ['李', '陈', '张', '刘', '周', '吴', '郑', '孙', '何', '徐', '黄', '林', '杨', '赵', '钱', '朱', '马', '胡', '郭', '罗', '梁', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾'];
  var WIFE_NAMES = [
    '秀英', '桂芳', '玉珍', '凤仙', '淑珍', '秀云', '佩兰', '丽华', '丽娟', '晓梅',
    '巧珍', '美玲', '秀兰', '桂香', '玉兰', '春花', '腊梅', '冬梅', '秋香', '素芬',
    '惠芬', '兰英', '月英', '凤英', '桂英', '雪梅', '彩霞', '红霞', '丽霞', '秀霞',
    '玉梅', '金花', '银花', '菊花', '杏花', '荷花', '莲英', '翠英', '秀珍', '凤珍',
    '慧敏', '慧兰', '雅芳', '雅琴', '淑芬', '淑兰', '美凤', '美云', '春兰', '秋菊',
    '冬雪', '晓霞', '丽丽', '娟娟', '婷婷', '静静', '敏敏', '艳红', '小红', '玉芳',
    '文娟', '文君', '文静', '文秀', '文芳', '文艳', '文莉', '文霞', '文婷', '文丽',
    '思远', '思颖', '思敏', '思婷'
  ];

  /** 各世基准出生年（每代约 30 年） */
  var BASE_YEAR = { 1: 1740, 2: 1770, 3: 1800, 4: 1830, 5: 1860, 6: 1890, 7: 1920, 8: 1950, 9: 1980, 10: 2010 };

  /** 可作为父亲的现有本族男性（按世次）；其余人物为场景用例，不再派生后代 */
  var EXT_FATHERS = {
    3: ['B02-G03-002', 'B03-G03-001'],
    4: ['B01-G04-003', 'B02-G04-001', 'B03-G04-001'],
    5: ['B01-G05-001', 'B01-G05-003', 'B02-G05-001', 'B02-G05-002', 'B03-G05-001'],
    6: ['B01-G06-001']
  };

  (function expand() {
    var byId = {};
    rawPersons.forEach(function (p) { byId[p.id] = p; });

    var wifeOf = {};
    SEED_MARRIAGES.forEach(function (m) { if (!wifeOf[m.husbandId]) wifeOf[m.husbandId] = m.wifeId; });

    // 已用 ID 序号 / 已用排行，避免与手写部分冲突
    var seqMap = {};
    var orderMap = {};
    rawPersons.forEach(function (p) {
      var k = p.branchId + '|' + p.generation;
      var n = parseInt(String(p.id).split('-')[2], 10) || 0;
      if (!seqMap[k] || n > seqMap[k]) seqMap[k] = n;
      if (p.fatherId && p.birthOrder) {
        orderMap[p.fatherId] = Math.max(orderMap[p.fatherId] || 0, Number(p.birthOrder));
      }
    });

    function nextId(branchId, gen) {
      var k = branchId + '|' + gen;
      // 派生序号自 101 起，与手写场景段（001 起）分开：
      // 测试新建成员时按小序号续号，不会与示例数据撞号
      seqMap[k] = Math.max(seqMap[k] || 0, 100) + 1;
      return branchId + '-G' + String(gen).padStart(2, '0') + '-' + String(seqMap[k]).padStart(3, '0');
    }

    function nextOrder(fatherId) {
      orderMap[fatherId] = (orderMap[fatherId] || 0) + 1;
      return orderMap[fatherId];
    }

    function birthYearOf(gen, i) { return BASE_YEAR[gen] + (i % 6); }

    /** 第 9 世及以后在世；此前各世均已故 */
    function deathYearOf(gen, birth, i) {
      if (gen >= 9) return '';
      return String(birth + 62 + (i % 18));
    }

    var malesByGen = {};
    var tailIdx = {};
    var wifeIdx = 0;
    var mSeq = 15;

    EXT_PLAN.forEach(function (plan) {
      var g = plan.gen;
      var pool = (EXT_FATHERS[g - 1] || []).concat(malesByGen[g - 1] || []);
      if (!pool.length) return;

      var born = [];
      var total = plan.males + plan.females;

      // 父亲池按房支分组并轮转，保证三房均衡延续（否则长房独大、旁支断代）
      var groups = {};
      var branchKeys = [];
      pool.forEach(function (id) {
        var b = (byId[id] || {}).branchId || 'B01';
        if (!groups[b]) { groups[b] = []; branchKeys.push(b); }
        groups[b].push(id);
      });
      branchKeys.sort();

      var used = {};   // 各房支已派生子女数
      for (var i = 0; i < total; i++) {
        var bk = branchKeys[i % branchKeys.length];
        var k = used[bk] || 0;
        used[bk] = k + 1;
        // 同一父亲连续派生 2 名子女，使同世次内存在同胞与堂亲（而非人人独子）
        var fatherId = groups[bk][Math.floor(k / 2) % groups[bk].length];
        var father = byId[fatherId];
        if (!father) continue;

        var isMale = i < plan.males;
        var idx = tailIdx[g] || 0;
        tailIdx[g] = idx + 1;
        var tail = TAIL[g][idx % TAIL[g].length];
        var genName = GEN_POEM[g - 1];
        var birth = birthYearOf(g, i);

        var p = {
          id: nextId(father.branchId, g),
          surname: '王',
          name: genName + tail,
          namePinyin: '',
          gender: isMale ? GENDER.MALE : GENDER.FEMALE,
          category: CATEGORY.CLAN,
          lineageType: isMale ? LINEAGE.CLAN : LINEAGE.OUT_MARRIED,
          generation: g,
          generationName: genName,
          birthOrder: nextOrder(fatherId),
          birthDate: String(birth),
          deathDate: deathYearOf(g, birth, i),
          fatherId: fatherId,
          motherId: wifeOf[fatherId] || null,
          branchId: father.branchId
        };
        if (!isMale) p.notes = '外嫁';
        rawPersons.push(p);
        byId[p.id] = p;
        if (isMale) born.push(p.id);
      }

      // 为本族男性配氏（末世部分未婚）
      for (var k = 0; k < plan.spouses && k < born.length; k++) {
        var hub = byId[born[k]];
        var hBirth = Number(hub.birthDate);
        var surname = WIFE_SURNAMES[wifeIdx % WIFE_SURNAMES.length];
        var wname = WIFE_NAMES[wifeIdx % WIFE_NAMES.length];
        wifeIdx++;

        var wBirth = hBirth + (wifeIdx % 5) - 1;
        var wDeath = hub.deathDate ? String(Number(hub.deathDate) + (wifeIdx % 7) - 3) : '';

        var wife = {
          id: nextId(hub.branchId, g),
          surname: surname,
          name: wname,
          namePinyin: '',
          gender: GENDER.FEMALE,
          category: CATEGORY.SPOUSE,
          lineageType: LINEAGE.CLAN,
          generation: g,
          birthOrder: 1,
          birthDate: String(wBirth),
          deathDate: wDeath,
          fatherId: null,
          motherId: null,
          branchId: hub.branchId
        };
        rawPersons.push(wife);
        byId[wife.id] = wife;
        wifeOf[hub.id] = wife.id;

        mSeq++;
        SEED_MARRIAGES.push({
          id: 'M-' + String(mSeq).padStart(3, '0'),
          husbandId: hub.id,
          wifeId: wife.id,
          type: MARRIAGE_TYPE.MARRY,
          order: 1,
          status: hub.deathDate ? MARRIAGE_STATUS.WIDOWED : MARRIAGE_STATUS.CURRENT,
          startYear: String(hBirth + 25 + (wifeIdx % 4)),
          endYear: hub.deathDate || ''
        });
      }

      malesByGen[g] = born;
    });
  })();

  var SEED_PERSONS = rawPersons.map(function (p) {
    var o = Object.assign({}, p);
    o.sortKey = S.buildSortKey(o);
    o.createdAt = now;
    o.updatedAt = now;
    return o;
  });

  var SEED_BRANCHES = [
    { id: 'B01', name: '长房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 1 },
    { id: 'B02', name: '二房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 2 },
    { id: 'B03', name: '三房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 3 }
  ];

  var SEED_META = [
    { key: 'version', value: '1.0' },
    { key: 'surname', value: '王' },
    { key: 'clanName', value: '示例宗族（虚构）' },
    { key: 'generationPoem', value: '守德建志承先泽延熙昆' }
  ];

  ZP.SEED = {
    persons: SEED_PERSONS,
    marriages: SEED_MARRIAGES,
    branches: SEED_BRANCHES,
    meta: SEED_META
  };
})(window);
