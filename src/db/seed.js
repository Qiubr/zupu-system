/**
 * 示例种子数据 — 开发调试用
 *
 * 规模：3 个房支（长房 B01 / 二房 B02 / 三房 B03）× 6 个世代（守·德·建·志·承·先）
 * 覆盖场景：
 *  嫁娶 · 多配偶（元配/续弦）· 入赘 · 出赘 · 过继 · 外嫁女 · 外嫁女子女入谱 ·
 *  离异 · 在世/已故 · 大宗分房 · 缺资料（仅必填字段）
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
      birthDate: '1898', deathDate: '1965',
      fatherId: null, motherId: null, branchId: 'B01',
      nativePlace: '浙江宁波', occupation: '农',
      bio: '始迁祖。清光绪年间自绍兴迁居宁波，耕读传家，生三子：德福、德禄、德华。'
    },
    {
      id: 'B01-G01-002', surname: '陈', name: '桂香', namePinyin: 'guixiang',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 1, birthOrder: 1,
      birthDate: '1902', deathDate: '1976', branchId: 'B01'
    },

    /* ══════════ 第 2 世 · 德字辈（三房分家） ══════════ */
    {
      id: 'B01-G02-001', surname: '王', name: '德福', namePinyin: 'defu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 1,
      birthDate: '1925', deathDate: '1998',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B01',
      occupation: '农', notes: '长房'
    },
    {
      id: 'B02-G02-001', surname: '王', name: '德禄', namePinyin: 'delu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 2,
      birthDate: '1928', deathDate: '2010',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B02',
      notes: '二房'
    },
    {
      id: 'B03-G02-001', surname: '王', name: '德华', namePinyin: 'dehua',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 2, generationName: '德', birthOrder: 3,
      birthDate: '1931', deathDate: '2005',
      fatherId: 'B01-G01-001', motherId: 'B01-G01-002', branchId: 'B03',
      notes: '三房'
    },
    // 长房德福配氏（多配偶：元配 + 续弦）
    {
      id: 'B01-G02-002', surname: '李', name: '秀英', namePinyin: 'xiuying',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1927', deathDate: '1993', branchId: 'B01'
    },
    {
      id: 'B01-G02-003', surname: '张', name: '桂芳', namePinyin: 'guifang',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 2,
      birthDate: '1940', branchId: 'B01'
    },
    {
      id: 'B02-G02-002', surname: '周', name: '玉珍', namePinyin: 'yuzhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1932', deathDate: '2015', branchId: 'B02'
    },
    {
      id: 'B03-G02-002', surname: '何', name: '凤仙', namePinyin: 'fengxian',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 2, birthOrder: 1,
      birthDate: '1935', deathDate: '2018', branchId: 'B03'
    },

    /* ══════════ 第 3 世 · 建字辈 ══════════ */
    {
      id: 'B01-G03-001', surname: '王', name: '建国', namePinyin: 'jianguo',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1955',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      occupation: '教师', notes: '无亲生子，过继胞弟建华之子志强为嗣'
    },
    {
      id: 'B01-G03-002', surname: '王', name: '建华', namePinyin: 'jianhua',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 2,
      birthDate: '1958',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      occupation: '工人'
    },
    // 外嫁女（其子女可选入谱）
    {
      id: 'B01-G03-003', surname: '王', name: '秀兰', namePinyin: 'xiulan',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.OUT_MARRIED,
      generation: 3, generationName: '建', birthOrder: 3,
      birthDate: '1960',
      fatherId: 'B01-G02-001', motherId: 'B01-G02-002', branchId: 'B01',
      notes: '嫁陈家'
    },
    {
      id: 'B01-G03-004', surname: '刘', name: '淑珍', namePinyin: 'shuzhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1957', branchId: 'B01'
    },
    {
      id: 'B01-G03-005', surname: '周', name: '秀云', namePinyin: 'xiuyun',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 2,
      birthDate: '1960', branchId: 'B01'
    },
    {
      id: 'B02-G03-001', surname: '王', name: '建军', namePinyin: 'jianjun',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1956',
      fatherId: 'B02-G02-001', motherId: 'B02-G02-002', branchId: 'B02'
    },
    {
      id: 'B02-G03-002', surname: '王', name: '建平', namePinyin: 'jianping',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 2,
      birthDate: '1962',
      fatherId: 'B02-G02-001', motherId: 'B02-G02-002', branchId: 'B02'
    },
    {
      id: 'B02-G03-003', surname: '徐', name: '佩兰', namePinyin: 'peilan',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1958', branchId: 'B02'
    },
    {
      id: 'B03-G03-001', surname: '王', name: '建中', namePinyin: 'jianzhong',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 3, generationName: '建', birthOrder: 1,
      birthDate: '1960',
      fatherId: 'B03-G02-001', motherId: 'B03-G02-002', branchId: 'B03'
    },
    {
      id: 'B03-G03-002', surname: '马', name: '丽华', namePinyin: 'lihua',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 3, birthOrder: 1,
      birthDate: '1963', branchId: 'B03'
    },

    /* ══════════ 第 4 世 · 志字辈 ══════════ */
    // 过继：建华之子 → 嗣父建国（世系图归嗣父，自动标注本生父）
    {
      id: 'B01-G04-001', surname: '王', name: '志强', namePinyin: 'zhiqiang',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1982',
      fatherId: 'B01-G03-002', adoptiveFatherId: 'B01-G03-001', branchId: 'B01',
      occupation: '工程师', notes: '过继给建国为嗣'
    },
    // 外嫁女子女入谱：仅挂生母，随母姓（外系）
    {
      id: 'B01-G04-002', surname: '陈', name: '明', namePinyin: 'chenming',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.EXTERNAL,
      generation: 4, birthOrder: 2,
      birthDate: '1985',
      motherId: 'B01-G03-003', branchId: 'B01',
      notes: '外嫁女秀兰之子，随母入谱'
    },
    {
      id: 'B01-G04-003', surname: '王', name: '志刚', namePinyin: 'zhigang',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 2,
      birthDate: '1987',
      fatherId: 'B01-G03-001', motherId: 'B01-G03-004', branchId: 'B01',
      occupation: '医生'
    },
    {
      id: 'B01-G04-004', surname: '赵', name: '丽娟', namePinyin: 'lijuan',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1980', branchId: 'B01'
    },
    {
      id: 'B01-G04-005', surname: '孙', name: '晓梅', namePinyin: 'xiaomei',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1989', branchId: 'B01'
    },
    // 招赘：本族女志敏 + 赘婿吴国梁（入赘），子女随母姓、挂母系
    {
      id: 'B01-G04-006', surname: '王', name: '志敏', namePinyin: 'zhimin',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 3,
      birthDate: '1988',
      fatherId: 'B01-G03-001', motherId: 'B01-G03-004', branchId: 'B01',
      notes: '招赘吴国梁'
    },
    {
      id: 'B01-G04-007', surname: '吴', name: '国梁', namePinyin: 'guoliang',
      gender: GENDER.MALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1987', branchId: 'B01',
      notes: '入赘王家'
    },
    {
      id: 'B02-G04-001', surname: '王', name: '志远', namePinyin: 'zhiyuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1984',
      fatherId: 'B02-G03-001', motherId: 'B02-G03-003', branchId: 'B02'
    },
    {
      id: 'B02-G04-002', surname: '王', name: '志宁', namePinyin: 'zhining',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 2,
      birthDate: '1988',
      fatherId: 'B02-G03-001', motherId: 'B02-G03-003', branchId: 'B02',
      notes: '嫁陈家，后离异；子随母入谱'
    },
    // 出赘：本族男志安出赘他家，后代不入本谱主线
    {
      id: 'B02-G04-003', surname: '王', name: '志安', namePinyin: 'zhian',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 3,
      birthDate: '1990',
      fatherId: 'B02-G03-002', branchId: 'B02',
      notes: '出赘林家，后代不入本谱主线'
    },
    {
      id: 'B02-G04-004', surname: '林', name: '巧珍', namePinyin: 'qiaozhen',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1986', branchId: 'B02'
    },
    {
      id: 'B02-G04-005', surname: '郑', name: '美玲', namePinyin: 'meiling',
      gender: GENDER.FEMALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1991', branchId: 'B02'
    },
    // 离异：二房志宁之夫（入谱为配偶）
    {
      id: 'B02-G04-006', surname: '陈', name: '志豪', namePinyin: 'chenzhihao',
      gender: GENDER.MALE, category: CATEGORY.SPOUSE, lineageType: LINEAGE.CLAN,
      generation: 4, birthOrder: 1,
      birthDate: '1986', branchId: 'B02'
    },
    {
      id: 'B03-G04-001', surname: '王', name: '志斌', namePinyin: 'zhibin',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 4, generationName: '志', birthOrder: 1,
      birthDate: '1986',
      fatherId: 'B03-G03-001', motherId: 'B03-G03-002', branchId: 'B03'
    },

    /* ══════════ 第 5 世 · 承字辈 ══════════ */
    {
      id: 'B01-G05-001', surname: '王', name: '承杰', namePinyin: 'chengjie',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '2002',
      fatherId: 'B01-G04-001', motherId: 'B01-G04-004', branchId: 'B01',
      occupation: '学生'
    },
    {
      id: 'B01-G05-002', surname: '王', name: '承悦', namePinyin: 'chengyue',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 2,
      birthDate: '2006',
      fatherId: 'B01-G04-003', motherId: 'B01-G04-005', branchId: 'B01'
    },
    // 入赘所生：生父为赘婿（配偶），世系归生母志敏，随母姓
    {
      id: 'B01-G05-003', surname: '王', name: '承轩', namePinyin: 'chengxuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 3,
      birthDate: '2013',
      fatherId: 'B01-G04-007', motherId: 'B01-G04-006', branchId: 'B01',
      notes: '入赘所生，随母姓'
    },
    {
      id: 'B02-G05-001', surname: '王', name: '承宇', namePinyin: 'chengyu',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '2010',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    {
      id: 'B02-G05-002', surname: '王', name: '承业', namePinyin: 'chengye',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 2,
      birthDate: '2014',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    {
      id: 'B02-G05-003', surname: '王', name: '承欢', namePinyin: 'chenghuan',
      gender: GENDER.FEMALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 3,
      birthDate: '2016',
      fatherId: 'B02-G04-001', motherId: 'B02-G04-004', branchId: 'B02'
    },
    // 外嫁女志宁之子，随母入谱（外系）
    {
      id: 'B02-G05-004', surname: '陈', name: '嘉轩', namePinyin: 'chenjiaxuan',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.EXTERNAL,
      generation: 5, birthOrder: 4,
      birthDate: '2012',
      motherId: 'B02-G04-002', branchId: 'B02',
      notes: '外嫁女志宁之子，随母入谱'
    },
    {
      id: 'B03-G05-001', surname: '王', name: '承曦', namePinyin: 'chengxi',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 5, generationName: '承', birthOrder: 1,
      birthDate: '2015',
      fatherId: 'B03-G04-001', branchId: 'B03'
    },

    /* ══════════ 第 6 世 · 先字辈（最幼一代） ══════════ */
    {
      id: 'B01-G06-001', surname: '王', name: '先禾', namePinyin: 'xianhe',
      gender: GENDER.MALE, category: CATEGORY.CLAN, lineageType: LINEAGE.CLAN,
      generation: 6, generationName: '先', birthOrder: 1,
      birthDate: '2025',
      fatherId: 'B01-G05-001', branchId: 'B01'
    }
  ];

  var SEED_PERSONS = rawPersons.map(function (p) {
    var o = Object.assign({}, p);
    o.sortKey = S.buildSortKey(o);
    o.createdAt = now;
    o.updatedAt = now;
    return o;
  });

  var SEED_MARRIAGES = [
    // 始祖
    {
      id: 'M-001', husbandId: 'B01-G01-001', wifeId: 'B01-G01-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1922', endYear: '1965'
    },
    // 长房德福 · 元配
    {
      id: 'M-002', husbandId: 'B01-G02-001', wifeId: 'B01-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1948', endYear: '1993'
    },
    // 长房德福 · 续弦（多配偶）
    {
      id: 'M-003', husbandId: 'B01-G02-001', wifeId: 'B01-G02-003',
      type: MARRIAGE_TYPE.MARRY, order: 2, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1995', endYear: '1998'
    },
    // 二房
    {
      id: 'M-004', husbandId: 'B02-G02-001', wifeId: 'B02-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1953', endYear: '2010'
    },
    // 三房
    {
      id: 'M-005', husbandId: 'B03-G02-001', wifeId: 'B03-G02-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.WIDOWED,
      startYear: '1957', endYear: '2005'
    },
    // 建字辈
    {
      id: 'M-006', husbandId: 'B01-G03-001', wifeId: 'B01-G03-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '1980'
    },
    {
      id: 'M-007', husbandId: 'B01-G03-002', wifeId: 'B01-G03-005',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '1981'
    },
    {
      id: 'M-008', husbandId: 'B02-G03-001', wifeId: 'B02-G03-003',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '1982'
    },
    {
      id: 'M-009', husbandId: 'B03-G03-001', wifeId: 'B03-G03-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '1984'
    },
    // 志字辈
    {
      id: 'M-010', husbandId: 'B01-G04-001', wifeId: 'B01-G04-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '2001'
    },
    {
      id: 'M-011', husbandId: 'B01-G04-003', wifeId: 'B01-G04-005',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '2010'
    },
    // 入赘
    {
      id: 'M-012', husbandId: 'B01-G04-007', wifeId: 'B01-G04-006',
      type: MARRIAGE_TYPE.RUZHUI, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '2011', notes: '赘婿入王家'
    },
    {
      id: 'M-013', husbandId: 'B02-G04-001', wifeId: 'B02-G04-004',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '2008'
    },
    // 出赘
    {
      id: 'M-014', husbandId: 'B02-G04-003', wifeId: 'B02-G04-005',
      type: MARRIAGE_TYPE.CHUZHUI, order: 1, status: MARRIAGE_STATUS.CURRENT,
      startYear: '2015', notes: '出赘林家'
    },
    // 离异
    {
      id: 'M-015', husbandId: 'B02-G04-006', wifeId: 'B02-G04-002',
      type: MARRIAGE_TYPE.MARRY, order: 1, status: MARRIAGE_STATUS.DIVORCED,
      startYear: '2010', endYear: '2018'
    }
  ];

  var SEED_BRANCHES = [
    { id: 'B01', name: '长房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 1 },
    { id: 'B02', name: '二房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 2 },
    { id: 'B03', name: '三房', parentBranchId: null, founderPersonId: 'B01-G01-001', sortOrder: 3 }
  ];

  var SEED_META = [
    { key: 'version', value: '1.0' },
    { key: 'surname', value: '王' },
    { key: 'clanName', value: '示例宗族（虚构）' },
    { key: 'generationPoem', value: '守德建志承先泽' }
  ];

  ZP.SEED = {
    persons: SEED_PERSONS,
    marriages: SEED_MARRIAGES,
    branches: SEED_BRANCHES,
    meta: SEED_META
  };
})(window);
